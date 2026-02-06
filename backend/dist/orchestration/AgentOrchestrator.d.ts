import OpenAI from 'openai';
import { PostgreSQLAdapter, SchemaMetadata } from '../adapters/postgres.js';
import { MCPServerConfig } from '../adapters/mcp.js';
import { EvaluationOutput, AgentResponse } from '../agents/types.js';
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
export declare class AgentOrchestrator {
    private queryAgent;
    private codeAgent;
    private executionAgent;
    private reasoningAgent;
    private dataInsightAgent;
    private chartAgent;
    private mcpClient;
    private mcpServerId;
    private mcpServerConfig;
    private maxRows;
    private maxIterations;
    private dbAdapter;
    private llm;
    constructor(llm: OpenAI, config?: OrchestratorConfig);
    /**
     * Connect to MCP server if configured
     */
    connectMCP(): Promise<void>;
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
    processQuery(userQuery: string, chatHistory?: Array<{
        role: string;
        content: string;
    }>): Promise<OrchestrationState>;
    /**
     * Get dataset insights (runs DataInsightAgent)
     */
    getDataInsights(): Promise<AgentResponse>;
    /**
     * Get raw schema metadata
     */
    getSchema(): Promise<SchemaMetadata>;
}
//# sourceMappingURL=AgentOrchestrator.d.ts.map