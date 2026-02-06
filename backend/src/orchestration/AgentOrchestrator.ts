import OpenAI from 'openai';
import { AgentContext, AgentRunResult } from '../adk/index.js';
import { PostgreSQLAdapter, SchemaMetadata } from '../adapters/postgres.js';
import { MCPClient, MCPServerConfig, getMCPClient } from '../adapters/mcp.js';
import { getLLMConfig } from '../config/llm.js';
import { QueryUnderstandingAgent } from '../agents/QueryUnderstandingAgent.js';
import { CodeGenerationAgent } from '../agents/CodeGenerationAgent.js';
import { ExecutionAgent } from '../agents/ExecutionAgent.js';
import { ReasoningAgent } from '../agents/ReasoningAgent.js';
import { DataInsightAgent } from '../agents/DataInsightAgent.js';
import { ChartGenerationAgent } from '../agents/ChartGenerationAgent.js';
import {
  QueryUnderstandingOutput,
  CodeGenerationOutput,
  ExecutionResult,
  ReasoningOutput,
  EvaluationOutput,
  DataInsightOutput,
  ChartGenerationOutput,
  VisualizationSpec,
  AgentResponse,
} from '../agents/types.js';

export interface IterationInfo {
  iteration: number;
  refinementContext?: string;
  evaluation?: EvaluationOutput;
}

export interface OrchestrationState {
  query: string;
  schemaMetadata: SchemaMetadata;
  responses: AgentResponse[];
  finalResult: unknown;
  iterations: number;
  iterationHistory: IterationInfo[];
}

export interface OrchestratorConfig {
  useMCP?: boolean;
  mcpServerConfig?: MCPServerConfig;
  modelOverride?: string;
  maxRows?: number;
  maxIterations?: number;
  dbAdapter?: PostgreSQLAdapter;
}

/**
 * AgentOrchestrator
 *
 * Coordinates the deterministic sequential agent loop:
 * User Input → QueryUnderstanding → (Chat Response OR CodeGeneration → Execution → Reasoning) → Response
 *
 * No autonomous branching. No background agents.
 */
export class AgentOrchestrator {
  private queryAgent: QueryUnderstandingAgent;
  private codeAgent: CodeGenerationAgent;
  private executionAgent: ExecutionAgent;
  private reasoningAgent: ReasoningAgent;
  private dataInsightAgent: DataInsightAgent;
  private chartAgent: ChartGenerationAgent;
  private mcpClient: MCPClient | null = null;
  private mcpServerId: string | null = null;
  private mcpServerConfig: MCPServerConfig | null = null;
  private maxRows: number;
  private maxIterations: number;
  private dbAdapter: PostgreSQLAdapter | null;
  private llm: OpenAI;

  constructor(llm: OpenAI, config?: OrchestratorConfig) {
    const llmConfig = getLLMConfig(config?.modelOverride);
    
    this.llm = llm;
    this.maxRows = config?.maxRows || 500;
    this.maxIterations = config?.maxIterations || 3;
    this.dbAdapter = config?.dbAdapter || null;

    // Create shared agent context
    const baseContext: AgentContext = {
      llm,
      config: {
        name: 'base',
        description: 'Base agent',
        model: llmConfig.model,
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
      },
    };

    // Initialize agents with ADK context
    this.queryAgent = new QueryUnderstandingAgent(baseContext);
    this.codeAgent = new CodeGenerationAgent(baseContext);
    this.reasoningAgent = new ReasoningAgent(baseContext);
    this.dataInsightAgent = new DataInsightAgent(baseContext);
    this.chartAgent = new ChartGenerationAgent(baseContext);

    // Store MCP config for lazy initialization
    if (config?.useMCP || process.env.USE_MCP_EXECUTION === 'true') {
      this.mcpServerConfig = config?.mcpServerConfig || {
        id: 'code-execution',
        name: 'Code Execution Server',
        transport: 'stdio',
        config: {
          command: process.env.MCP_SERVER_COMMAND || 'npx',
          args: (process.env.MCP_SERVER_ARGS || '-y @anthropic-ai/mcp-server-code-execution').split(' '),
        },
      };
    }

    // Pass dbAdapter to ExecutionAgent for session-specific database access
    this.executionAgent = new ExecutionAgent(baseContext, this.dbAdapter ?? undefined);
  }

  /**
   * Connect to MCP server if configured
   */
  async connectMCP(): Promise<void> {
    if (this.mcpServerConfig) {
      this.mcpClient = getMCPClient();
      await this.mcpClient.connect(this.mcpServerConfig);
      this.mcpServerId = this.mcpServerConfig.id;
      
      // Update ExecutionAgent with MCP client
      this.executionAgent.setMCPClient(this.mcpClient, this.mcpServerId);
      console.log('[Orchestrator] Connected to MCP server:', this.mcpServerId);
    }
  }

  /**
   * Main query processing loop with AI self-evaluation
   *
   * Follows deterministic sequence with optional refinement loop:
   * 1. Query Understanding (intent classification + chat detection)
   * 2. If casual chat → return immediate response
   * 3. Code Generation (SQL/JS) with max 500 rows
   * 4. Execution (sandboxed)
   * 5. Reasoning (natural language explanation)
   * 6. Evaluation (AI decides if result satisfies query)
   * 7. If not satisfied and iterations < max, loop back to step 3 with refinement context
   */
  async processQuery(userQuery: string, chatHistory?: Array<{role: string, content: string}>): Promise<OrchestrationState> {
    // Build contextual query with chat history if available
    const contextualQuery = chatHistory && chatHistory.length > 0
      ? `Previous conversation:\n${chatHistory.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')}\n\nCurrent query: ${userQuery}`
      : userQuery;

    console.log('[Orchestrator] Starting agent loop for query:', userQuery);

    // Stage 1: Query Understanding (determines if chat or DB query)
    console.log('[Orchestrator] Stage 1: Query Understanding');
    const understandingResult = await this.queryAgent.executeTool<
      { query: string },
      QueryUnderstandingOutput
    >('classify', { query: contextualQuery });

    const understandingOutput = understandingResult.output || {
      requiresDatabase: true,
      shouldVisualize: false,
      intent: 'unknown',
    };

    // Handle casual chat - return immediately without DB access
    if (!understandingOutput.requiresDatabase) {
      console.log('[Orchestrator] Detected casual chat, returning immediate response');
      const chatState: OrchestrationState = {
        query: userQuery,
        schemaMetadata: { tables: [], lastUpdated: new Date() },
        responses: [
          {
            stage: 'understanding',
            output: understandingOutput,
            timestamp: new Date(),
          },
          {
            stage: 'chat',
            output: { message: understandingOutput.chatResponse || "I'm here to help you analyze your data. Ask me anything about your database!" },
            timestamp: new Date(),
          },
        ],
        finalResult: {
          data: [],
          explanation: understandingOutput.chatResponse || "I'm here to help you analyze your data. Ask me anything about your database!",
          insights: [],
          executionTime: 0,
          requiresVisualization: false,
          iterations: 0,
          isChat: true,
        },
        iterations: 0,
        iterationHistory: [],
      };
      return chatState;
    }

    // For DB queries, ensure adapter is available
    if (!this.dbAdapter) {
      throw new Error('Database not configured. Please configure the database connection first.');
    }

    const state: OrchestrationState = {
      query: userQuery,
      schemaMetadata: await this.dbAdapter.getSchemaMetadata(),
      responses: [],
      finalResult: null,
      iterations: 0,
      iterationHistory: [],
    };

    state.responses.push({
      stage: 'understanding',
      output: understandingOutput,
      timestamp: new Date(),
    });

    if (!understandingResult.success) {
      console.error('[Orchestrator] Query understanding failed:', understandingResult.error);
    }

    // Loop for code generation, execution, reasoning, and evaluation
    let refinementContext: string | undefined;
    let lastExecutionOutput: ExecutionResult | null = null;
    let lastReasoningOutput: ReasoningOutput | null = null;
    let lastCodeOutput: CodeGenerationOutput | null = null;
    let visualizationSpec: VisualizationSpec | undefined;

    while (state.iterations < this.maxIterations) {
      state.iterations++;
      const iterationInfo: IterationInfo = {
        iteration: state.iterations,
        refinementContext,
      };

      console.log(`[Orchestrator] Iteration ${state.iterations}/${this.maxIterations}`);

      // Stage 2: Code Generation
      console.log('[Orchestrator] Stage 2: Code Generation');
      const codeResult = await this.codeAgent.executeTool<
        { query: string; schema: SchemaMetadata; requiresVisualization: boolean; maxRows: number; refinementContext?: string },
        CodeGenerationOutput
      >('generate', {
        query: userQuery,
        schema: state.schemaMetadata,
        requiresVisualization: understandingOutput.shouldVisualize,
        maxRows: this.maxRows,
        refinementContext,
      });

      lastCodeOutput = codeResult.output || {
        code: '',
        language: 'sql' as const,
        requiresVisualization: false,
      };

      state.responses.push({
        stage: 'generation',
        output: lastCodeOutput,
        timestamp: new Date(),
      });

      if (!codeResult.success) {
        console.error('[Orchestrator] Code generation failed:', codeResult.error);
        state.finalResult = { error: codeResult.error };
        return state;
      }

      // Stage 3: Execution
      console.log('[Orchestrator] Stage 3: Execution');
      const executionResult = await this.executionAgent.executeTool<
        { code: string; language: 'sql' | 'javascript' },
        ExecutionResult
      >('execute', {
        code: lastCodeOutput.code,
        language: lastCodeOutput.language,
      });

      lastExecutionOutput = executionResult.output || {
        success: false,
        error: 'Execution failed',
        executionTime: 0,
      };

      state.responses.push({
        stage: 'execution',
        output: lastExecutionOutput,
        timestamp: new Date(),
      });

      if (!lastExecutionOutput.success) {
        console.error('[Orchestrator] Execution failed:', lastExecutionOutput.error);
        // On execution error, try to refine if we have iterations left
        if (state.iterations < this.maxIterations) {
          refinementContext = `Previous SQL execution failed with error: ${lastExecutionOutput.error}. Please fix the query.`;
          state.iterationHistory.push(iterationInfo);
          continue;
        }
        state.finalResult = { error: lastExecutionOutput.error };
        return state;
      }

      // Stage 4: Reasoning
      console.log('[Orchestrator] Stage 4: Reasoning');
      const reasoningResult = await this.reasoningAgent.executeTool<
        { query: string; executionResult: unknown },
        ReasoningOutput
      >('reason', {
        query: userQuery,
        executionResult: lastExecutionOutput.data,
      });

      lastReasoningOutput = reasoningResult.output || {
        explanation: 'Unable to generate explanation.',
        insights: [],
      };

      state.responses.push({
        stage: 'reasoning',
        output: lastReasoningOutput,
        timestamp: new Date(),
      });

      // Stage 5: Evaluation (AI self-assessment)
      console.log('[Orchestrator] Stage 5: Evaluation');
      const evaluationResult = await this.reasoningAgent.executeTool<
        { query: string; executionResult: unknown; explanation: string },
        EvaluationOutput
      >('evaluate', {
        query: userQuery,
        executionResult: lastExecutionOutput.data,
        explanation: lastReasoningOutput.explanation,
      });

      const evaluationOutput = evaluationResult.output || {
        satisfiesQuery: true,
        reason: 'Evaluation completed',
      };

      iterationInfo.evaluation = evaluationOutput;
      state.iterationHistory.push(iterationInfo);

      console.log(`[Orchestrator] Evaluation: satisfies=${evaluationOutput.satisfiesQuery}, reason="${evaluationOutput.reason}"`);

      // If satisfied or no more iterations, break
      if (evaluationOutput.satisfiesQuery || state.iterations >= this.maxIterations) {
        // Stage 6: Chart Generation (if visualization needed and we have data)
        if (understandingOutput.shouldVisualize && lastExecutionOutput?.data && lastExecutionOutput.data.length > 0) {
          console.log('[Orchestrator] Stage 6: Chart Generation');
          try {
            const chartResult = await this.chartAgent.executeTool<
              { query: string; data: Record<string, unknown>[]; explanation: string },
              ChartGenerationOutput
            >('generateChart', {
              query: userQuery,
              data: lastExecutionOutput.data as Record<string, unknown>[],
              explanation: lastReasoningOutput?.explanation || '',
            });

            if (chartResult.success && chartResult.output) {
              visualizationSpec = chartResult.output.visualizationSpec;
              console.log(`[Orchestrator] Chart generated: type=${visualizationSpec.type}, title="${visualizationSpec.title}"`);
            }
          } catch (chartError) {
            console.warn('[Orchestrator] Chart generation failed, will use frontend auto-detection:', chartError);
          }
        }
        break;
      }

      // Prepare refinement context for next iteration
      refinementContext = evaluationOutput.suggestedRefinement || 
        `The previous result did not fully satisfy the query. Reason: ${evaluationOutput.reason}. Please generate a better query.`;
      
      console.log(`[Orchestrator] Refining query with context: ${refinementContext}`);
    }

    // Assemble final result
    state.finalResult = {
      data: lastExecutionOutput?.data,
      explanation: lastReasoningOutput?.explanation || 'No explanation available',
      insights: lastReasoningOutput?.insights || [],
      executionTime: lastExecutionOutput?.executionTime || 0,
      requiresVisualization: lastCodeOutput?.requiresVisualization || false,
      visualizationSpec,
      iterations: state.iterations,
      iterationHistory: state.iterationHistory,
    };

    return state;
  }

  /**
   * Get dataset insights (runs DataInsightAgent)
   */
  async getDataInsights(): Promise<AgentResponse> {
    // Double-check adapter is configured before proceeding
    if (!this.dbAdapter) {
      console.error('[Orchestrator] dbAdapter is null in getDataInsights!');
      throw new Error('Database adapter not initialized. Please configure the database connection first.');
    }
    
    const schemaMetadata = await this.dbAdapter.getSchemaMetadata();

    const result = await this.dataInsightAgent.executeTool<
      { schema: SchemaMetadata },
      DataInsightOutput
    >('analyzeSchema', { schema: schemaMetadata });

    return {
      stage: 'insight',
      output: result.output || {
        datasetDescription: 'Unable to analyze schema',
        suggestedQuestions: [],
        tableCount: schemaMetadata.tables.length,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get raw schema metadata
   */
  async getSchema(): Promise<SchemaMetadata> {
    if (!this.dbAdapter) {
      throw new Error('Database not configured. Please configure the database connection first.');
    }
    return this.dbAdapter.getSchemaMetadata();
  }
}
