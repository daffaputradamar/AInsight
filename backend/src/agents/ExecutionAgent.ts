import { Agent, AgentContext, z } from '../adk/index.js';
import { PostgreSQLAdapter } from '../adapters/postgres.js';
import { MCPClient, MCPServerConfig, getMCPClient } from '../adapters/mcp.js';
import { ExecutionResult } from './types.js';

const ExecuteInputSchema = z.object({
  code: z.string().describe('Code to execute'),
  language: z.enum(['sql', 'javascript']).describe('Code language'),
});

type ExecuteInput = z.infer<typeof ExecuteInputSchema>;

/**
 * ExecutionAgent
 *
 * Executes generated code safely in a sandboxed environment.
 * Supports PostgreSQL queries and in-memory JavaScript transformations.
 * Can delegate to MCP for Docker-based execution.
 */
export class ExecutionAgent extends Agent {
  private mcpClient: MCPClient | null = null;
  private mcpServerId: string | null = null;
  private useMCP: boolean;
  private dbAdapter: PostgreSQLAdapter | null = null;

  constructor(context: AgentContext, dbAdapter?: PostgreSQLAdapter, mcpClient?: MCPClient, mcpServerId?: string) {
    super({
      ...context,
      config: {
        ...context.config,
        name: 'execution',
        description: 'Safely executes SQL and JavaScript code',
      },
    });

    this.dbAdapter = dbAdapter || null;
    this.mcpClient = mcpClient || null;
    this.mcpServerId = mcpServerId || null;
    this.useMCP = process.env.USE_MCP_EXECUTION === 'true';
  }

  protected registerTools(): void {
    this.registerTool({
      name: 'execute',
      description: 'Execute code safely and return results',
      inputSchema: ExecuteInputSchema,
      handler: this.execute.bind(this),
    });
  }

  private async execute(input: ExecuteInput): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Delegate to MCP if configured and connected
      if (this.useMCP && this.mcpClient && this.mcpServerId && this.mcpClient.isConnected(this.mcpServerId)) {
        return await this.executeViaMCP(input, startTime);
      }

      // Local execution
      if (input.language === 'sql') {
        return await this.executeSQLCode(input.code, startTime);
      } else {
        return await this.executeJavaScriptCode(input.code, startTime);
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      };
    }
  }

  /**
   * Delegate execution to MCP server (Docker)
   */
  private async executeViaMCP(input: ExecuteInput, startTime: number): Promise<ExecutionResult> {
    console.log('[ExecutionAgent] Delegating to MCP server');

    if (!this.mcpClient || !this.mcpServerId) {
      throw new Error('MCP client or server ID not configured');
    }

    try {
      const toolName = input.language === 'sql' ? 'execute_query' : 'execute_code';
      const args = input.language === 'sql' ? { sql: input.code } : { code: input.code };
      
      const resultText = await this.mcpClient.callTool(this.mcpServerId, toolName, args);
      const executionTime = Date.now() - startTime;

      // Try to parse result as JSON, otherwise return as text
      try {
        const parsed = JSON.parse(resultText);
        return {
          success: true,
          data: Array.isArray(parsed) ? parsed : [parsed],
          executionTime,
        };
      } catch {
        return {
          success: true,
          data: [{ result: resultText }],
          executionTime,
        };
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'MCP execution failed',
        executionTime,
      };
    }
  }

  /**
   * Execute SQL locally via PostgreSQL adapter
   */
  private async executeSQLCode(code: string, startTime: number): Promise<ExecutionResult> {
    // Validate SQL for dangerous patterns
    const forbiddenPatterns = [
      /DROP\s+TABLE/i,
      /DROP\s+DATABASE/i,
      /DELETE\s+FROM/i,
      /TRUNCATE/i,
      /ALTER\s+TABLE/i,
      /CREATE\s+TABLE/i,
      /INSERT\s+INTO/i,
      /UPDATE\s+.*\s+SET/i,
      /GRANT/i,
      /REVOKE/i,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(code)) {
        throw new Error('Dangerous SQL operation detected. Read-only queries only.');
      }
    }

    if (!this.dbAdapter) {
      throw new Error('Database adapter not configured. Please configure the database connection first.');
    }

    const data = await this.dbAdapter.executeQuery(code);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data,
      executionTime,
    };
  }

  /**
   * Execute JavaScript in a sandboxed environment
   */
  private async executeJavaScriptCode(code: string, startTime: number): Promise<ExecutionResult> {
    // Create a restricted sandbox context
    const blockedGlobals = [
      'require',
      'process',
      'global',
      'globalThis',
      '__dirname',
      '__filename',
      'module',
      'exports',
      'Buffer',
      'fetch',
      'XMLHttpRequest',
      'WebSocket',
      'eval',
      'Function',
    ];

    // Validate code doesn't try to access blocked globals
    for (const global of blockedGlobals) {
      // Check for direct usage (not as property access)
      const pattern = new RegExp(`(?<![.\\w])${global}(?![\\w])`, 'g');
      if (pattern.test(code)) {
        throw new Error(`Access to '${global}' is not allowed in sandbox`);
      }
    }

    try {
      // Provide fetchData function for SQL queries
      const fetchData = async (sql: string): Promise<any[]> => {
        if (!this.dbAdapter) {
          throw new Error('Database adapter not configured');
        }
        return await this.dbAdapter.executeQuery(sql);
      };

      // Provide sql tagged template function
      const sql = (strings: TemplateStringsArray, ...values: any[]) => {
        let query = strings[0];
        for (let i = 0; i < values.length; i++) {
          query += String(values[i]) + strings[i + 1];
        }
        return fetchData(query);
      };

      // Execute in a restricted scope
      // eslint-disable-next-line no-new-func
      const fn = new Function(
        'fetchData',
        'sql',
        'data',
        'console',
        `"use strict";
        const require = undefined;
        const process = undefined;
        const global = undefined;
        const globalThis = undefined;
        const fetch = undefined;
        
        return (async () => {
          ${code}
        })();`,
      );

      const mockConsole = {
        log: (...args: unknown[]) => console.log('[Sandbox]', ...args),
        error: (...args: unknown[]) => console.error('[Sandbox]', ...args),
        warn: (...args: unknown[]) => console.warn('[Sandbox]', ...args),
      };

      const result = await fn(fetchData, sql, {}, mockConsole);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: Array.isArray(result) ? result : [result],
        executionTime,
      };
    } catch (error) {
      throw new Error(
        `JavaScript execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Set MCP client for delegation
   */
  setMCPClient(client: MCPClient, serverId?: string): void {
    this.mcpClient = client;
    if (serverId) {
      this.mcpServerId = serverId;
    }
  }

  /**
   * Enable/disable MCP execution
   */
  setUseMCP(useMCP: boolean): void {
    this.useMCP = useMCP;
  }
}
