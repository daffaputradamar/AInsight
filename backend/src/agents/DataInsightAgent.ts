import OpenAI from 'openai';
import { getLLMConfig } from '../config/llm';
import { SchemaMetadata } from '../adapters/postgres';
import { DataInsightOutput } from './types';

export class DataInsightAgent {
  private llm: OpenAI;
  private config = getLLMConfig();

  constructor(llm: OpenAI) {
    this.llm = llm;
  }

  async analyzeSchema(schema: SchemaMetadata): Promise<DataInsightOutput> {
    const schemaStr = this.formatSchemaForAnalysis(schema);
    const systemPrompt = `You are a data analyst. Given a database schema, provide insights.

Respond with JSON:
{
  "datasetDescription": "brief description of dataset",
  "suggestedQuestions": ["question 1", "question 2", "question 3"]
}

Rules:
- Description: 1-2 sentences about what data is contained
- Questions: 3-5 analytical questions a user might ask
- Focus on realistic, useful questions`;

    const message = await this.llm.messages.create({
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: schemaStr,
        },
      ],
      system: systemPrompt,
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    try {
      const parsed = JSON.parse(responseText);
      return {
        datasetDescription: parsed.datasetDescription || 'Database dataset',
        suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions : [],
        tableCount: schema.tables.length,
      };
    } catch {
      console.error('Failed to parse insight response:', responseText);
      return {
        datasetDescription: this.generateDefaultDescription(schema),
        suggestedQuestions: this.generateDefaultQuestions(schema),
        tableCount: schema.tables.length,
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
