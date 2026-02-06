import { Agent, AgentContext } from '../adk/index.js';
/**
 * ReasoningAgent
 *
 * Generates natural language explanations of execution results.
 * Output is 2-3 sentences of plain English.
 * No code, no markdown, no technical mechanics.
 */
export declare class ReasoningAgent extends Agent {
    constructor(context: AgentContext);
    protected registerTools(): void;
    private reason;
    private evaluate;
}
//# sourceMappingURL=ReasoningAgent.d.ts.map