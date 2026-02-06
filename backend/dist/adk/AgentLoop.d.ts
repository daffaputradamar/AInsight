/**
 * ADK.js Agent Loop
 *
 * Provides deterministic sequential orchestration for multi-agent systems.
 * Agents are executed in a fixed order with results passed forward.
 */
import { Agent, AgentRunResult } from './Agent.js';
export interface LoopStage<TInput = unknown, TOutput = unknown> {
    name: string;
    agent: Agent;
    toolName: string;
    inputMapper: (state: LoopState) => TInput;
    outputMapper?: (output: TOutput, state: LoopState) => void;
    skipCondition?: (state: LoopState) => boolean;
}
export interface LoopState {
    query: string;
    metadata: Record<string, unknown>;
    results: Map<string, AgentRunResult>;
    error?: string;
}
export interface LoopResult {
    success: boolean;
    state: LoopState;
    stages: AgentRunResult[];
    totalExecutionTime: number;
}
export interface AgentLoopConfig {
    name: string;
    stages: LoopStage[];
    onStageStart?: (stageName: string, state: LoopState) => void;
    onStageComplete?: (stageName: string, result: AgentRunResult, state: LoopState) => void;
    onError?: (stageName: string, error: Error, state: LoopState) => void;
}
/**
 * AgentLoop orchestrates multiple agents in a deterministic sequence
 */
export declare class AgentLoop {
    private config;
    constructor(config: AgentLoopConfig);
    /**
     * Run the agent loop with the given query
     */
    run(query: string, metadata?: Record<string, unknown>): Promise<LoopResult>;
    /**
     * Get the loop name
     */
    get name(): string;
    /**
     * Get stage names
     */
    getStageNames(): string[];
}
//# sourceMappingURL=AgentLoop.d.ts.map