import OpenAI from 'openai';
import { getLLMConfig } from '../config/llm';
import { ReasoningOutput } from './types';

export class ReasoningAgent {
  private llm: OpenAI;
  private config = getLLMConfig();

  constructor(llm: OpenAI) {
    this.llm = llm;
  }

  async reason(query: string, executionResult: unknown): Promise<ReasoningOutput> {
    const systemPrompt = `You are a data analyst. Given a user query and execution result, provide a concise, natural language explanation.

Rules:
- Response must be 2-3 sentences maximum
- Natural language only (no code, no technical details)
- Focus on insights, not implementation
- Avoid mentioning SQL, JavaScript, or technical mechanics
- If result is empty, explain what this means
- Extract key insights from the data`;

    const resultStr = JSON.stringify(executionResult, null, 2).substring(0, 1000);

    const message = await this.llm.messages.create({
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: `Query: "${query}"\n\nResult:\n${resultStr}`,
        },
      ],
      system: systemPrompt,
      temperature: 0.7,
      max_tokens: 300,
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse response into explanation and insights
    const sentences = responseText.split(/[.!?]+/).filter((s) => s.trim());
    const explanation = sentences.slice(0, 3).join('. ').trim();
    const insights = sentences
      .slice(3)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return {
      explanation,
      insights,
    };
  }
}
