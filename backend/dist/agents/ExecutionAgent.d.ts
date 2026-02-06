import { Agent, AgentContext } from '../adk/index.js';
import { PostgreSQLAdapter } from '../adapters/postgres.js';
import { MCPClient } from '../adapters/mcp.js';
/**
 * ExecutionAgent
 *
 * Executes generated code safely in a sandboxed environment.
 * Supports PostgreSQL queries and in-memory JavaScript transformations.
 * Can delegate to MCP for Docker-based execution.
 */
export declare class ExecutionAgent extends Agent {
    private mcpClient;
    private mcpServerId;
    private useMCP;
    private dbAdapter;
    constructor(context: AgentContext, dbAdapter?: PostgreSQLAdapter, mcpClient?: MCPClient, mcpServerId?: string);
    protected registerTools(): void;
    private execute;
    /**
     * Delegate execution to MCP server (Docker)
     */
    private executeViaMCP;
    /**
     * Execute SQL locally via PostgreSQL adapter
     */
    private executeSQLCode;
    /**
     * Execute JavaScript in a sandboxed environment
     */
    private executeJavaScriptCode;
    /**
     * Set MCP client for delegation
     */
    setMCPClient(client: MCPClient, serverId?: string): void;
    /**
     * Enable/disable MCP execution
     */
    setUseMCP(useMCP: boolean): void;
}
//# sourceMappingURL=ExecutionAgent.d.ts.map