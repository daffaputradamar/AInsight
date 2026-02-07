import { Agent, AgentContext, z } from '../adk/index.js';
import { VisualizationSpec, ChartGenerationOutput } from './types.js';

const GenerateChartInputSchema = z.object({
  query: z.string().describe('Original user query'),
  data: z.array(z.record(z.string(), z.unknown())).describe('Query result data'),
  explanation: z.string().describe('Reasoning from the reasoning agent'),
});

const ChartSpecOutputSchema = z.object({
  type: z.enum(['bar', 'line', 'scatter', 'pie', 'table']),
  title: z.string(),
  xAxis: z.string(),
  yAxis: z.string(),
  reasoning: z.string(),
});

type GenerateChartInput = z.infer<typeof GenerateChartInputSchema>;

/**
 * ChartGenerationAgent
 *
 * Analyzes query results and determines the most suitable visualization type.
 * Uses AI to intelligently select chart type, axes, and title based on:
 * - Data structure and column types
 * - User query intent
 * - Best practices for data visualization
 */
export class ChartGenerationAgent extends Agent {
  constructor(context: AgentContext) {
    super({
      ...context,
      config: {
        ...context.config,
        name: 'chart-generation',
        description: 'Generates optimal visualization specifications from query results',
      },
    });
  }

  protected registerTools(): void {
    this.registerTool({
      name: 'generateChart',
      description: 'Generate a visualization specification for query results',
      inputSchema: GenerateChartInputSchema,
      handler: this.generateChart.bind(this),
    });
  }

  private async generateChart(input: GenerateChartInput): Promise<ChartGenerationOutput> {
    // Extract column information from data
    const dataColumns = input.data.length > 0 ? Object.keys(input.data[0]) : [];
    const sampleData = JSON.stringify(input.data.slice(0, 5), null, 2);
    const rowCount = input.data.length;

    // Analyze column types
    const columnAnalysis = this.analyzeColumns(input.data, dataColumns);

    const systemPrompt = `You are a data visualization expert. Given query results, determine the optimal chart type and configuration.

Available columns: ${dataColumns.join(', ')}

Column analysis:
${columnAnalysis}

Data has ${rowCount} rows.

Rules for chart type selection:
- BAR: Use for categorical comparisons, rankings, or when comparing discrete categories. Best when x-axis has distinct categories.
- LINE: Use for time series, trends over time, or continuous data progression. Best when x-axis represents time or sequential order.
- PIE: Use for part-to-whole relationships showing proportions. Only use when you have 2-7 categories and values represent parts of a whole (percentages, counts that sum to a total).
- SCATTER: Use for showing correlation or relationship between two numeric variables.
- TABLE: Use when the data is better understood in tabular form, has many columns, or visualization doesn't add significant value.

Axis selection rules:
- xAxis: Should be the categorical, date/time, or independent variable column
- yAxis: Should be a numeric/quantitative column that makes sense to aggregate or compare

Respond with JSON only:
{
  "type": "bar|line|scatter|pie|table",
  "title": "Descriptive chart title",
  "xAxis": "column_name_for_x_axis",
  "yAxis": "column_name_for_y_axis", 
  "reasoning": "Brief explanation of why this chart type and these axes were chosen"
}`;

    try {
      const result = await this.chatJSON(
        systemPrompt,
        `User query: "${input.query}"\n\nData explanation: ${input.explanation}\n\nSample data (first 5 rows):\n${sampleData}`,
        ChartSpecOutputSchema,
        { temperature: 0.3, maxTokens: 400 },
      );

      return {
        visualizationSpec: {
          type: result.type,
          title: result.title,
          xAxis: result.xAxis,
          yAxis: result.yAxis,
        },
        reasoning: result.reasoning,
      };
    } catch (error) {
      console.error('[ChartGenerationAgent] LLM chart generation failed, using fallback auto-detection:', error instanceof Error ? error.message : error);
      // Fallback to auto-detection
      return this.fallbackChartSpec(input.query, dataColumns, input.data);
    }
  }

  /**
   * Analyze columns to determine their types (numeric, categorical, date, etc.)
   */
  private analyzeColumns(data: Record<string, unknown>[], columns: string[]): string {
    if (data.length === 0) return 'No data available';

    const analysis: string[] = [];

    for (const col of columns) {
      const values = data.slice(0, 10).map(row => row[col]);
      const nonNullValues = values.filter(v => v !== null && v !== undefined);

      if (nonNullValues.length === 0) {
        analysis.push(`- ${col}: unknown (all null)`);
        continue;
      }

      const firstValue = nonNullValues[0];
      const isNumeric = nonNullValues.every(v => typeof v === 'number' || !isNaN(Number(v)));
      const isDate = this.looksLikeDate(col, nonNullValues);
      const uniqueCount = new Set(nonNullValues.map(String)).size;
      const isCategorical = uniqueCount <= 20 && !isNumeric;

      let type = 'text';
      if (isDate) type = 'date/time';
      else if (isNumeric) type = 'numeric';
      else if (isCategorical) type = `categorical (${uniqueCount} unique values)`;

      analysis.push(`- ${col}: ${type}`);
    }

    return analysis.join('\n');
  }

  /**
   * Check if a column looks like a date field
   */
  private looksLikeDate(colName: string, values: unknown[]): boolean {
    const dateKeywords = ['date', 'time', 'year', 'month', 'day', 'created', 'updated', 'timestamp'];
    const colLower = colName.toLowerCase();
    
    if (dateKeywords.some(kw => colLower.includes(kw))) {
      return true;
    }

    // Check if values look like dates
    const sampleValue = String(values[0]);
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/, // ISO date
      /^\d{2}\/\d{2}\/\d{4}/, // US date
      /^\d{2}-\d{2}-\d{4}/, // EU date
    ];

    return datePatterns.some(pattern => pattern.test(sampleValue));
  }

  /**
   * Fallback chart specification when AI generation fails
   */
  private fallbackChartSpec(
    query: string,
    columns: string[],
    data: Record<string, unknown>[]
  ): ChartGenerationOutput {
    // Find first text/categorical column for x-axis
    const xAxis = columns.find(col => {
      const val = data[0]?.[col];
      return typeof val === 'string' && isNaN(Number(val));
    }) || columns[0];

    // Find first numeric column for y-axis
    const yAxis = columns.find(col => {
      const val = data[0]?.[col];
      return typeof val === 'number' || (!isNaN(Number(val)) && col !== xAxis);
    }) || columns[1] || columns[0];

    // Determine chart type based on data characteristics
    let type: VisualizationSpec['type'] = 'bar';
    const rowCount = data.length;

    if (rowCount > 50) {
      type = 'table';
    } else if (rowCount <= 7 && columns.length === 2) {
      type = 'pie';
    }

    return {
      visualizationSpec: {
        type,
        title: query.slice(0, 50) + (query.length > 50 ? '...' : ''),
        xAxis,
        yAxis,
      },
      reasoning: 'Fallback: Auto-detected based on data structure',
    };
  }
}
