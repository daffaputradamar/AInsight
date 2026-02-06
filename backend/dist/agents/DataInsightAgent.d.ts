import { Agent, AgentContext } from '../adk/index.js';
/**
 * DataInsightAgent
 *
 * Analyzes database schema on load and generates:
 * - Dataset description (what the data contains)
 * - Suggested analytical questions users might ask
 */
export declare class DataInsightAgent extends Agent {
    constructor(context: AgentContext);
    protected registerTools(): void;
    private analyzeSchema;
    private formatSchemaForAnalysis;
    private generateDefaultDescription;
    private generateDefaultQuestions;
}
//# sourceMappingURL=DataInsightAgent.d.ts.map