import { Agent, AgentContext } from '../adk/index.js';
/**
 * ChartGenerationAgent
 *
 * Analyzes query results and determines the most suitable visualization type.
 * Uses AI to intelligently select chart type, axes, and title based on:
 * - Data structure and column types
 * - User query intent
 * - Best practices for data visualization
 */
export declare class ChartGenerationAgent extends Agent {
    constructor(context: AgentContext);
    protected registerTools(): void;
    private generateChart;
    /**
     * Analyze columns to determine their types (numeric, categorical, date, etc.)
     */
    private analyzeColumns;
    /**
     * Check if a column looks like a date field
     */
    private looksLikeDate;
    /**
     * Fallback chart specification when AI generation fails
     */
    private fallbackChartSpec;
}
//# sourceMappingURL=ChartGenerationAgent.d.ts.map