/**
 * ADK.js Agent Loop
 *
 * Provides deterministic sequential orchestration for multi-agent systems.
 * Agents are executed in a fixed order with results passed forward.
 */
/**
 * AgentLoop orchestrates multiple agents in a deterministic sequence
 */
export class AgentLoop {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Run the agent loop with the given query
     */
    async run(query, metadata = {}) {
        const startTime = Date.now();
        const state = {
            query,
            metadata,
            results: new Map(),
        };
        const stageResults = [];
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
            }
            catch (error) {
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
    get name() {
        return this.config.name;
    }
    /**
     * Get stage names
     */
    getStageNames() {
        return this.config.stages.map((s) => s.name);
    }
}
//# sourceMappingURL=AgentLoop.js.map