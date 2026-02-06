import { Agent, AgentContext } from '../adk/index.js';
/**
 * CodeGenerationAgent
 *
 * Generates executable SQL or JavaScript code based on user queries.
 * Output is ONLY code - no explanations, no comments.
 * Chooses between SQL (data queries) and JavaScript (transformations).
 */
export declare class CodeGenerationAgent extends Agent {
    constructor(context: AgentContext);
    protected registerTools(): void;
    private generate;
    private extractCode;
    private formatSchemaForPrompt;
}
//# sourceMappingURL=CodeGenerationAgent.d.ts.map