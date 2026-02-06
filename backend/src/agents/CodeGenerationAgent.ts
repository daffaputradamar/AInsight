import { Agent, AgentContext, z } from '../adk/index.js';
import { SchemaMetadata } from '../adapters/postgres.js';
import { CodeGenerationOutput } from './types.js';

const GenerateInputSchema = z.object({
  query: z.string().describe('User query'),
  schema: z.custom<SchemaMetadata>().describe('Database schema metadata'),
  requiresVisualization: z.boolean().describe('Whether visualization is needed'),
  maxRows: z.number().optional().describe('Maximum rows to return (default 500)'),
  refinementContext: z.string().optional().describe('Context from previous iteration for refinement'),
});

type GenerateInput = z.infer<typeof GenerateInputSchema>;

/**
 * CodeGenerationAgent
 *
 * Generates executable SQL or JavaScript code based on user queries.
 * Output is ONLY code - no explanations, no comments.
 * Chooses between SQL (data queries) and JavaScript (transformations).
 */
export class CodeGenerationAgent extends Agent {
  constructor(context: AgentContext) {
    super({
      ...context,
      config: {
        ...context.config,
        name: 'code-generation',
        description: 'Generates executable SQL or JavaScript code from natural language',
      },
    });
  }

  protected registerTools(): void {
    this.registerTool({
      name: 'generate',
      description: 'Generate executable code from user query and schema',
      inputSchema: GenerateInputSchema,
      handler: this.generate.bind(this),
    });
  }

  private async generate(input: GenerateInput): Promise<CodeGenerationOutput> {
    const schemaStr = this.formatSchemaForPrompt(input.schema);
    const maxRows = input.maxRows || 500;
    const systemPrompt = `You are a SQL code generator. Generate executable code based on user queries and database schema.

Database Schema:
${schemaStr}

Rules:
- Output ONLY executable code (SQL or JavaScript)
- No explanations, comments, or markdown outside code blocks
- Wrap SQL in triple backticks: \`\`\`sql
- Wrap JavaScript in triple backticks: \`\`\`javascript
- STRONGLY PREFER SQL over JavaScript - use SQL for all data retrieval queries
- Only use JavaScript when complex data transformation is absolutely needed AFTER fetching data
- Never use INSERT, UPDATE, DELETE, or DROP statements
- Only SELECT queries with JOIN, GROUP BY, ORDER BY as needed
- Must use ONLY columns that exist in the schema above
- ALWAYS include LIMIT ${maxRows} in SQL queries unless user explicitly specifies a different limit
- If user asks for "all" data, still limit to ${maxRows} rows

JavaScript Sandbox Rules (ONLY if JavaScript is absolutely necessary):
- You have access to: fetchData(sqlQuery) - executes SQL and returns array of rows
- You have access to: sql\`...\` - tagged template for SQL queries (same as fetchData)
- FORBIDDEN: require, import, fetch, db, process, global, Buffer, eval, Function
- FORBIDDEN: Any external libraries or Node.js APIs
- JavaScript code MUST return the final result array
- Example JavaScript pattern:
  const data = await fetchData("SELECT * FROM table LIMIT 100");
  return data.map(row => ({ ...row, computed: row.value * 2 }));`;

    const visualization = input.requiresVisualization
      ? '\n- User wants visualization enabled'
      : '\n- No visualization required';

    const refinement = input.refinementContext
      ? `\n\nPrevious attempt feedback: ${input.refinementContext}`
      : '';

    const responseText = await this.chat(
      systemPrompt,
      `${input.query}${visualization}${refinement}`,
      { temperature: this.config.temperature, maxTokens: this.config.maxTokens },
    );

    let { code, language } = this.extractCode(responseText);

    // Ensure SQL queries have LIMIT if not present
    if (language === 'sql' && !code.toLowerCase().includes('limit')) {
      code = code.replace(/;?\s*$/, ` LIMIT ${maxRows};`);
    }

    return {
      code,
      language: language as 'sql' | 'javascript',
      requiresVisualization: input.requiresVisualization,
    };
  }

  private extractCode(responseText: string): { code: string; language: string } {
    const sqlMatch = responseText.match(/```sql\n?([\s\S]*?)\n?```/);
    if (sqlMatch) {
      return { code: sqlMatch[1].trim(), language: 'sql' };
    }

    const jsMatch = responseText.match(/```javascript\n?([\s\S]*?)\n?```/);
    if (jsMatch) {
      return { code: jsMatch[1].trim(), language: 'javascript' };
    }

    const genericMatch = responseText.match(/```\n?([\s\S]*?)\n?```/);
    if (genericMatch) {
      const code = genericMatch[1].trim();
      return {
        code,
        language: code.toLowerCase().includes('select') ? 'sql' : 'javascript',
      };
    }

    return { code: responseText.trim(), language: 'javascript' };
  }

  private formatSchemaForPrompt(schema: SchemaMetadata): string {
    return schema.tables
      .map((table) => {
        const columns = table.columns
          .map((col) => `  - ${col.name}: ${col.type}${col.nullable ? ' (nullable)' : ''}`)
          .join('\n');
        return `Table: ${table.name} (${table.rowCount} rows)\n${columns}`;
      })
      .join('\n\n');
  }
}
