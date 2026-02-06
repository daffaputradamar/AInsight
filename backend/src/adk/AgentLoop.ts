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
export class AgentLoop {
  private config: AgentLoopConfig;

  constructor(config: AgentLoopConfig) {
    this.config = config;
  }

  /**
   * Run the agent loop with the given query
   */
  async run(query: string, metadata: Record<string, unknown> = {}): Promise<LoopResult> {
    const startTime = Date.now();
    const state: LoopState = {
      query,
      metadata,
      results: new Map(),
    };

    const stageResults: AgentRunResult[] = [];

    for (const stage of this.config.stages) {
      // Check skip condition
      if (stage.skipCondition?.(state)) {
        console.log(`[AgentLoop] Skipping stage: ${stage.name}`);
        continue;
      }

      console.log(`[AgentLoop] Running stage: ${stage.name}`);
      this.config.onStageStart?.(stage.name, state);

      try {
        // Map input from state
        const input = stage.inputMapper(state);

        // Execute agent tool
        const result = await stage.agent.executeTool(stage.toolName, input);
        stageResults.push(result);

        // Store result in state
        state.results.set(stage.name, result);

        // Apply output mapper if provided
        if (result.success && stage.outputMapper && result.output) {
          stage.outputMapper(result.output, state);
        }

        this.config.onStageComplete?.(stage.name, result, state);

        // Stop loop if stage failed
        if (!result.success) {
          console.error(`[AgentLoop] Stage '${stage.name}' failed:`, result.error);
          state.error = result.error;
          break;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        console.error(`[AgentLoop] Stage '${stage.name}' threw:`, err);
        this.config.onError?.(stage.name, err, state);
        state.error = err.message;

        stageResults.push({
          success: false,
          error: err.message,
          executionTime: 0,
          agentName: stage.agent.name,
          timestamp: new Date(),
        });
        break;
      }
    }

    return {
      success: !state.error,
      state,
      stages: stageResults,
      totalExecutionTime: Date.now() - startTime,
    };
  }

  /**
   * Get the loop name
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Get stage names
   */
  getStageNames(): string[] {
    return this.config.stages.map((s) => s.name);
  }
}
