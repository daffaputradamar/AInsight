import OpenAI from 'openai';
import { getLLMConfig } from '../config/llm';
import { SchemaMetadata } from '../adapters/postgres';
import { CodeGenerationOutput } from './types';

export class CodeGenerationAgent {
  private llm: OpenAI;
  private config = getLLMConfig();

  constructor(llm: OpenAI) {
    this.llm = llm;
  }

  async generate(
    query: string,
    schema: SchemaMetadata,
    requiresVisualization: boolean,
  ): Promise<CodeGenerationOutput> {
    const schemaStr = this.formatSchemaForPrompt(schema);
    const systemPrompt = `You are a SQL code generator. Generate executable code based on user queries and database schema.

Database Schema:
${schemaStr}

Rules:
- Output ONLY executable code (SQL or JavaScript)
- No explanations, comments, or markdown
- Wrap SQL in triple backticks: \`\`\`sql
- Wrap JavaScript in triple backticks: \`\`\`javascript
- For data transformation/visualization logic, use JavaScript
- For pure data retrieval, use SQL
- Never use INSERT, UPDATE, DELETE, or DROP statements
- Only SELECT queries with JOIN, GROUP BY, ORDER BY as needed`;

    const visualization = requiresVisualization
      ? '\n- User wants visualization enabled'
      : '\n- No visualization required';

    const message = await this.llm.messages.create({
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: `${query}${visualization}`,
        },
      ],
      system: systemPrompt,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const { code, language } = this.extractCode(responseText);

    return {
      code,
      language: language as 'sql' | 'javascript',
      requiresVisualization,
    };
  }

  private extractCode(responseText: string): { code: string; language: string } {
    const sqlMatch = responseText.match(/```sql\n([\s\S]*?)\n```/);
    if (sqlMatch) {
      return { code: sqlMatch[1].trim(), language: 'sql' };
    }

    const jsMatch = responseText.match(/```javascript\n([\s\S]*?)\n```/);
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

    return { code: responseText, language: 'javascript' };
  }

  private formatSchemaForPrompt(schema: SchemaMetadata): string {
    return schema.tables
      .map((table) => {
        const columns = table.columns.map((col) => `  - ${col.name}: ${col.type}${col.nullable ? ' (nullable)' : ''}`).join('\n');
        return `Table: ${table.name} (${table.rowCount} rows)\n${columns}`;
      })
      .join('\n\n');
  }
}
