import { Agent, AgentContext } from '../adk/index.js';
/**
 * QueryUnderstandingAgent
 *
 * Classifies user intent and determines if visualization is needed.
 * Uses LLM classification (NOT keyword heuristics).
 * Responds strictly with true or false for shouldVisualize.
 */
export declare class QueryUnderstandingAgent extends Agent {
    constructor(context: AgentContext);
    protected registerTools(): void;
    private classify;
    private getDefaultChatResponse;
    private inferIntent;
}
//# sourceMappingURL=QueryUnderstandingAgent.d.ts.map