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
  confirmationRequired?: boolean;
  confirmationType?: "query" | "chart" | null;
  confirmation?: unknown; // ChartOption[] or QueryConfirmation
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
   * Extract the last response output for a given pipeline stage from a responses array.
   * Used to restore cached intermediate results without re-running LLM agents.
   */
  private extractFromResponses<T>(responses: AgentResponse[], stage: string): T | null {
    const found = [...responses].reverse().find(r => r.stage === stage);
    return found ? (found.output as T) : null;
  }

  /**
   * Main query processing loop with AI self-evaluation.
   *
   * Follows a deterministic sequence with confirmation checkpoints:
   *   Stage 1 → Stage 2 → [Checkpoint 1: confirm SQL]
   *   → Stage 3 → Stage 4 → Stage 5 → [Checkpoint 2: select chart]
   *   → Chart Generation → Final Result
   *
   * When cachedState is provided (server stored state at a previous checkpoint),
   * completed stages are skipped, avoiding redundant LLM calls:
   *   • approve      → skip Stages 1+2, resume at Stage 3
   *   • modify       → skip Stage 1, redo Stage 2 with user feedback, re-show Checkpoint 1
   *   • select-chart → skip Stages 1-5, resume at Chart Generation only
   */
  async processQuery(
    userQuery: string,
    chatHistory?: Array<{role: string, content: string}>,
    confirmAction?: {action: string, payload?: any},
    cachedState?: OrchestrationState
  ): Promise<OrchestrationState> {
    // Always prefer the explicit userQuery; fall back to query stored in cache
    const effectiveQuery = userQuery || cachedState?.query || '';

    if (!effectiveQuery && !confirmAction) {
      throw new Error('Query is required when no confirmation action is provided');
    }

    console.log('[Orchestrator] Starting agent loop for query:', effectiveQuery || '(confirmation action)');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // FAST PATH ▸ select-chart
    // Skip the entire pipeline — use execution + reasoning from cache.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (confirmAction?.action === 'select-chart' && cachedState) {
      const lastExec = this.extractFromResponses<ExecutionResult>(cachedState.responses, 'execution');
      const lastReasoning = this.extractFromResponses<ReasoningOutput>(cachedState.responses, 'reasoning');
      const selectedType = confirmAction.payload?.chartType as string | undefined;

      console.log(`[Orchestrator] Fast path ▸ chart generation (type=${selectedType})`);

      let visualizationSpec: VisualizationSpec | undefined;

      if (lastExec?.data && lastExec.data.length > 0 && selectedType) {
        try {
          const chartResult = await this.chartAgent.executeTool<
            { query: string; data: Record<string, unknown>[]; explanation: string; chartType: string },
            ChartGenerationOutput
          >('generateChart', {
            query: effectiveQuery,
            data: lastExec.data as Record<string, unknown>[],
            explanation: lastReasoning?.explanation || '',
            chartType: selectedType,
          });

          if (chartResult.success && chartResult.output) {
            visualizationSpec = chartResult.output.visualizationSpec;
            console.log(`[Orchestrator] Chart generated: type=${visualizationSpec.type}, title="${visualizationSpec.title}"`);
          }
        } catch (err) {
          console.warn('[Orchestrator] Chart generation failed:', err);
        }
      }

      return {
        ...cachedState,
        confirmationRequired: false,
        confirmationType: null,
        confirmation: undefined,
        finalResult: {
          ...(cachedState.finalResult as object),
          requiresVisualization: true,
          visualizationSpec,
        },
      };
    }

    // Build contextual query with chat history if available
    const contextualQuery = chatHistory && chatHistory.length > 0
      ? `Previous conversation:\n${chatHistory.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')}\n\nCurrent query: ${effectiveQuery}`
      : effectiveQuery;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 1 ▸ Query Understanding
    // Skipped when resuming from a confirmation checkpoint — the user
    // already submitted this query and the intent hasn't changed.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let understandingOutput: QueryUnderstandingOutput;

    const isResuming = !!(cachedState && confirmAction);

    if (isResuming) {
      console.log('[Orchestrator] Stage 1: Restored from cache (skipping LLM call)');
      understandingOutput =
        this.extractFromResponses<QueryUnderstandingOutput>(cachedState!.responses, 'understanding') ||
        { requiresDatabase: true, shouldVisualize: false, intent: 'db_query' };
    } else {
      console.log('[Orchestrator] Stage 1: Query Understanding');
      const understandingResult = await this.queryAgent.executeTool<
        { query: string },
        QueryUnderstandingOutput
      >('classify', { query: contextualQuery });

      understandingOutput = understandingResult.output || {
        requiresDatabase: true,
        shouldVisualize: false,
        intent: 'unknown',
      };

      // Handle casual chat — return immediately without DB access
      if (!understandingOutput.requiresDatabase) {
        console.log('[Orchestrator] Detected casual chat, returning immediate response');
        const chatState: OrchestrationState = {
          query: effectiveQuery,
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

      if (!understandingResult.success) {
        console.error('[Orchestrator] Query understanding failed:', understandingResult.error);
      }
    }

    // For DB queries, ensure adapter is available
    if (!this.dbAdapter) {
      throw new Error('Database not configured. Please configure the database connection first.');
    }

    // Restore schema from cache to avoid an extra DB round-trip on resume
    const schemaMetadata = cachedState?.schemaMetadata ?? await this.dbAdapter.getSchemaMetadata();

    const state: OrchestrationState = {
      query: effectiveQuery,
      schemaMetadata,
      responses: isResuming
        // Keep only the understanding stage from the cache; remaining stages will be appended
        ? cachedState!.responses.filter(r => r.stage === 'understanding')
        : [{ stage: 'understanding', output: understandingOutput, timestamp: new Date() }],
      finalResult: null,
      iterations: 0,
      iterationHistory: cachedState?.iterationHistory ?? [],
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // FAST PATH ▸ approve
    // The user approved the generated SQL — reuse cached code and skip
    // stage 2 (Code Generation) on the first iteration, jumping straight
    // to Stage 3 (Execution).
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let preloadedCode: CodeGenerationOutput | null = null;
    if (confirmAction?.action === 'approve' && cachedState) {
      const cachedCode = this.extractFromResponses<CodeGenerationOutput>(cachedState.responses, 'generation');
      if (cachedCode) {
        console.log('[Orchestrator] Stage 2: Restored from cache (user approved generated query)');
        preloadedCode = cachedCode;
        state.responses.push({ stage: 'generation', output: cachedCode, timestamp: new Date() });
      }
    }

    // Loop for code generation, execution, reasoning, and evaluation
    let refinementContext: string | undefined;
    let lastExecutionOutput: ExecutionResult | null = null;
    let lastReasoningOutput: ReasoningOutput | null = null;
    let lastCodeOutput: CodeGenerationOutput | null = null;
    let visualizationSpec: VisualizationSpec | undefined;

    // For modify: prime the refinement context from user instruction + cached code
    if (confirmAction?.action === 'modify' && cachedState) {
      const cachedCode = this.extractFromResponses<CodeGenerationOutput>(cachedState.responses, 'generation');
      refinementContext = `User feedback: ${confirmAction.payload?.userInstruction || 'Please improve the query'}.${cachedCode ? `\nOriginal code:\n${cachedCode.code}` : ''}`;
      console.log('[Orchestrator] Modify requested — will regenerate code with refinement context');
    }

    while (state.iterations < this.maxIterations) {
      state.iterations++;
      const iterationInfo: IterationInfo = {
        iteration: state.iterations,
        refinementContext,
      };

      console.log(`[Orchestrator] Iteration ${state.iterations}/${this.maxIterations}`);

      // Stage 2: Code Generation
      // On the first iteration of an 'approve' flow, reuse the preloaded cached code
      // so we don't re-generate SQL the user already approved.
      if (preloadedCode && state.iterations === 1) {
        lastCodeOutput = preloadedCode;
        preloadedCode = null; // consume it
        console.log('[Orchestrator] Stage 2: Skipped (using approved cached code)');
      } else {
        console.log('[Orchestrator] Stage 2: Code Generation');
        const codeResult = await this.codeAgent.executeTool<
          { query: string; schema: SchemaMetadata; requiresVisualization: boolean; maxRows: number; refinementContext?: string },
          CodeGenerationOutput
        >('generate', {
          query: effectiveQuery,
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
      }

      // CHECKPOINT 1: Show generated/modified SQL to user for confirmation.
      // Triggers on:
      //   • Fresh query (no confirmAction) — always on iteration 1
      //   • Modify action — on iteration 1 after re-generating with user feedback
      const triggerCheckpoint1 =
        state.iterations === 1 &&
        (!confirmAction || confirmAction.action === 'modify');

      if (triggerCheckpoint1) {
        const label = confirmAction?.action === 'modify' ? 'Modified' : 'Generated';
        console.log(`[Orchestrator] Checkpoint 1: Showing ${label} query to user`);
        return {
          ...state,
          confirmationRequired: true,
          confirmationType: 'query',
          confirmation: {
            type: 'query',
            pendingCode: {
              code: lastCodeOutput!.code,
              language: lastCodeOutput!.language,
              explanation: lastCodeOutput!.explanation,
            },
          },
        };
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
        query: effectiveQuery,
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
        query: effectiveQuery,
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
        // Before checkpoint 2, save the execution output so final assembly has access to it
        if (!lastExecutionOutput || !lastReasoningOutput || !lastCodeOutput) {
          console.error('[Orchestrator] Missing execution data before checkpoint 2');
          state.finalResult = { error: 'Missing execution data' };
          return state;
        }

        // CHECKPOINT 2: Chart Type Recommendation
        // Always ask user to select chart type if we have data
        if (lastExecutionOutput?.data && lastExecutionOutput.data.length > 0) {
          // Generate chart recommendations
          console.log('[Orchestrator] Checkpoint 2: Generating chart recommendations');
          try {
            const chartOptions = await this.generateChartOptions(
              effectiveQuery,
              lastExecutionOutput.data as Record<string, unknown>[],
              lastReasoningOutput?.explanation || ''
            );

            // If user hasn't selected chart yet, ask them
            if (!confirmAction || confirmAction.action !== 'select-chart') {
              console.log('[Orchestrator] Asking user to select chart type');
              // Assemble full result even at checkpoint (needed when resuming with select-chart)
              const fullState = {
                ...state,
                confirmationRequired: true,
                confirmationType: 'chart' as const,
                confirmation: {
                  type: 'chart',
                  chartOptions,
                  data: lastExecutionOutput.data as Record<string, unknown>[],
                },
                finalResult: {
                  data: lastExecutionOutput.data,
                  explanation: lastReasoningOutput?.explanation || 'No explanation available',
                  insights: lastReasoningOutput?.insights || [],
                  executionTime: lastExecutionOutput?.executionTime || 0,
                  requiresVisualization: lastCodeOutput?.requiresVisualization || false,
                  iterations: state.iterations,
                  iterationHistory: state.iterationHistory,
                },
              };
              return fullState;
            }

            // User selected chart type - find the selected option and generate the spec
            const selectedChartType = confirmAction?.payload?.chartType;
            const selectedOption = chartOptions.find(opt => opt.type === selectedChartType);
            if (selectedOption) {
              console.log(`[Orchestrator] User selected chart type: ${selectedChartType}`);
              const chartResult = await this.chartAgent.executeTool<
                { query: string; data: Record<string, unknown>[]; explanation: string; chartType: string },
                ChartGenerationOutput
              >('generateChart', {
                query: effectiveQuery,
                data: lastExecutionOutput.data as Record<string, unknown>[],
                explanation: lastReasoningOutput?.explanation || '',
                chartType: selectedChartType,
              });

              if (chartResult.success && chartResult.output) {
                visualizationSpec = chartResult.output.visualizationSpec;
                console.log(`[Orchestrator] Chart generated: type=${visualizationSpec.type}, title="${visualizationSpec.title}"`);
              }
            }
          } catch (chartError) {
            console.warn('[Orchestrator] Chart recommendation failed, will use frontend auto-detection:', chartError);
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
   * Generate ranked chart options for user selection
   */
  private async generateChartOptions(
    query: string,
    data: Record<string, unknown>[],
    explanation: string
  ): Promise<Array<{type: "bar" | "line" | "scatter" | "pie" | "table"; label: string; score: number; reasoning: string; isRecommended: boolean}>> {
    const allChartTypes: ("bar" | "line" | "scatter" | "pie" | "table")[] = ["bar", "line", "scatter", "pie", "table"];
    
    // Use heuristic scoring based on data
    const columns = data.length > 0 ? Object.keys(data[0]) : [];
    const numericColumns = columns.filter(col => {
      const val = data[0]?.[col];
      return typeof val === 'number';
    });
    
    const categoricalColumns = columns.filter(col => {
      const val = data[0]?.[col];
      return typeof val === 'string' || typeof val === 'boolean';
    });
    
    const dateColumns = columns.filter(col => {
      const val = data[0]?.[col];
      return val instanceof Date || (typeof val === 'string' && !isNaN(Date.parse(val)));
    });

    const scores: Record<string, number> = {
      bar: (categoricalColumns.length > 0 ? 10 : 3) + (numericColumns.length > 0 ? 8 : 0),
      line: (dateColumns.length > 0 ? 10 : 5) + (numericColumns.length > 0 ? 8 : 0),
      scatter: (numericColumns.length >= 2 ? 10 : 2),
      pie: (categoricalColumns.length > 0 && numericColumns.length > 0 ? 8 : 2),
      table: 5, // Always viable fallback
    };

    const sortedTypes = [...allChartTypes].sort((a, b) => scores[b] - scores[a]);
    
    return sortedTypes.map((type, idx) => ({
      type,
      label: type.charAt(0).toUpperCase() + type.slice(1) + ' Chart',
      score: scores[type],
      reasoning: this.getChartReasoning(type, columns, numericColumns, categoricalColumns, dateColumns),
      isRecommended: idx === 0, // First is recommended
    }));
  }

  /**
   * Get reasoning for chart type recommendation
   */
  private getChartReasoning(
    chartType: string,
    allColumns: string[],
    numericColumns: string[],
    categoricalColumns: string[],
    dateColumns: string[]
  ): string {
    const reasons: Record<string, string> = {
      bar: `Good for comparing ${categoricalColumns.length > 0 ? 'categories' : 'values'}${numericColumns.length > 0 ? ' across numeric values' : ''}`,
      line: `Perfect for showing trends${dateColumns.length > 0 ? ' over time' : ''}`,
      scatter: `Ideal for finding correlations between ${numericColumns.length} numeric columns`,
      pie: `Shows proportions and percentages in your data`,
      table: `Displays all data in structured format`,
    };
    return reasons[chartType] || 'A way to visualize your data';
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
