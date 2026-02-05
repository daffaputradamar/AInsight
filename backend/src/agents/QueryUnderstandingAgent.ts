import OpenAI from 'openai';
import { getLLMConfig } from '../config/llm';
import { QueryUnderstandingOutput } from './types';

export class QueryUnderstandingAgent {
  private llm: OpenAI;
  private config = getLLMConfig();

  constructor(llm: OpenAI) {
    this.llm = llm;
  }

  async classify(query: string): Promise<QueryUnderstandingOutput> {
    const systemPrompt = `You are an intent classifier. Given a user query, determine if it requires data visualization.

Respond ONLY with valid JSON in this exact format:
{
  "shouldVisualize": true or false,
  "intent": "brief description of intent"
}

Rules:
- Respond with strict boolean true/false ONLY
- Never explain reasoning
- If query mentions: charts, graphs, plot, visualize, show, display, histogram, timeline, trend → shouldVisualize: true
- If query is purely analytical, mathematical, or text-based → shouldVisualize: false`;

    const message = await this.llm.messages.create({
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: query,
        },
      ],
      system: systemPrompt,
      temperature: 0.3,
      max_tokens: 100,
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    try {
      const parsed = JSON.parse(responseText);
      return {
        shouldVisualize: Boolean(parsed.shouldVisualize),
        intent: parsed.intent || 'analysis',
      };
    } catch {
      console.error('Failed to parse classification response:', responseText);
      return {
        shouldVisualize: false,
        intent: 'unknown',
      };
    }
  }
}
