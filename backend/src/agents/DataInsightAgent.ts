import { Agent, AgentContext, z } from '../adk';
import { SchemaMetadata } from '../adapters/postgres';
import { DataInsightOutput } from './types';

const AnalyzeSchemaInputSchema = z.object({
  schema: z.custom<SchemaMetadata>().describe('Database schema metadata'),
});

const AnalyzeSchemaOutputSchema = z.object({
  datasetDescription: z.string(),
  suggestedQuestions: z.array(z.string()),
});

type AnalyzeSchemaInput = z.infer<typeof AnalyzeSchemaInputSchema>;

/**
 * DataInsightAgent
 *
 * Analyzes database schema on load and generates:
 * - Dataset description (what the data contains)
 * - Suggested analytical questions users might ask
 */
export class DataInsightAgent extends Agent {
  constructor(context: AgentContext) {
    super({
      ...context,
      config: {
        ...context.config,
        name: 'data-insight',
        description: 'Analyzes database schema and suggests analytical questions',
      },
    });
  }

  protected registerTools(): void {
    this.registerTool({
      name: 'analyzeSchema',
      description: 'Analyze schema and generate insights',
      inputSchema: AnalyzeSchemaInputSchema,
      handler: this.analyzeSchema.bind(this),
    });
  }

  private async analyzeSchema(input: AnalyzeSchemaInput): Promise<DataInsightOutput> {
    const schemaStr = this.formatSchemaForAnalysis(input.schema);
    const systemPrompt = `You are a data analyst. Given a database schema, provide insights.

Respond with JSON:
{
  "datasetDescription": "brief description of dataset",
  "suggestedQuestions": ["question 1", "question 2", "question 3", "question 4", "question 5"]
}

Rules:
- Description: 1-2 sentences about what data is contained
- Questions: 3-5 analytical questions a user might ask
- Focus on realistic, useful questions
- Questions should be answerable with the available data
- Make questions progressively more complex/interesting`;

    try {
      const result = await this.chatJSON(
        systemPrompt,
        schemaStr,
        AnalyzeSchemaOutputSchema,
        { temperature: 0.7, maxTokens: 500 },
      );

      return {
        datasetDescription: result.datasetDescription || 'Database dataset',
        suggestedQuestions: Array.isArray(result.suggestedQuestions) ? result.suggestedQuestions : [],
        tableCount: input.schema.tables.length,
      };
    } catch (error) {
      console.error('[DataInsightAgent] Failed to parse insight response:', error);
      return {
        datasetDescription: this.generateDefaultDescription(input.schema),
        suggestedQuestions: this.generateDefaultQuestions(input.schema),
        tableCount: input.schema.tables.length,
      };
    }
  }

  private formatSchemaForAnalysis(schema: SchemaMetadata): string {
    const tableDescriptions = schema.tables
      .map((table) => {
        const columns = table.columns.map((col) => `${col.name} (${col.type})`).join(', ');
        return `Table: ${table.name}\nColumns: ${columns}\nRows: ${table.rowCount}`;
      })
      .join('\n\n');

    return `Database Schema Analysis:\n\n${tableDescriptions}`;
  }

  private generateDefaultDescription(schema: SchemaMetadata): string {
    const tableNames = schema.tables.map((t) => t.name).join(', ');
    return `This database contains ${schema.tables.length} tables: ${tableNames}. It stores various data entities and their relationships.`;
  }

  private generateDefaultQuestions(schema: SchemaMetadata): string[] {
    return [
      'What are the most recent entries in the database?',
      'How is the data distributed across different categories?',
      'Are there any trends or patterns in the data?',
      'What are the relationships between different tables?',
      'How much data is stored in this database?',
    ];
  }
}
