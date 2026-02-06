import { Agent, AgentContext, z } from '../adk';
import { ReasoningOutput, EvaluationOutput } from './types';

const ReasonInputSchema = z.object({
  query: z.string().describe('Original user query'),
  executionResult: z.unknown().describe('Result from code execution'),
});

const EvaluateInputSchema = z.object({
  query: z.string().describe('Original user query'),
  executionResult: z.unknown().describe('Result from code execution'),
  explanation: z.string().describe('Generated explanation'),
});

type ReasonInput = z.infer<typeof ReasonInputSchema>;
type EvaluateInput = z.infer<typeof EvaluateInputSchema>;

/**
 * ReasoningAgent
 *
 * Generates natural language explanations of execution results.
 * Output is 2-3 sentences of plain English.
 * No code, no markdown, no technical mechanics.
 */
export class ReasoningAgent extends Agent {
  constructor(context: AgentContext) {
    super({
      ...context,
      config: {
        ...context.config,
        name: 'reasoning',
        description: 'Generates natural language explanations of data results',
      },
    });
  }

  protected registerTools(): void {
    this.registerTool({
      name: 'reason',
      description: 'Generate explanation for execution results',
      inputSchema: ReasonInputSchema,
      handler: this.reason.bind(this),
    });

    this.registerTool({
      name: 'evaluate',
      description: 'Evaluate if the result satisfies the user query',
      inputSchema: EvaluateInputSchema,
      handler: this.evaluate.bind(this),
    });
  }

  private async reason(input: ReasonInput): Promise<ReasoningOutput> {
    const systemPrompt = `You are a data analyst. Given a user query and execution result, provide a concise, natural language explanation.

Rules:
- Response must be 2-3 sentences maximum
- Natural language only (no code, no technical details)
- Focus on insights, not implementation
- Avoid mentioning SQL, JavaScript, databases, or technical mechanics
- If result is empty, explain what this means in plain terms
- Extract key insights from the data
- Use simple, clear language a non-technical person would understand

Output format: Just write the explanation directly. No JSON, no markdown, no formatting.`;

    const resultStr = JSON.stringify(input.executionResult, null, 2).substring(0, 2000);

    const responseText = await this.chat(
      systemPrompt,
      `Query: "${input.query}"\n\nResult:\n${resultStr}`,
      { temperature: 0.7, maxTokens: 300 },
    );

    // Parse response into explanation and insights
    const cleanedText = responseText.trim();
    const sentences = cleanedText.split(/[.!?]+/).filter((s) => s.trim());
    const explanation = sentences.slice(0, 3).join('. ').trim();
    const insights = sentences
      .slice(3)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Ensure explanation ends with punctuation
    const finalExplanation = explanation.match(/[.!?]$/) ? explanation : `${explanation}.`;

    return {
      explanation: finalExplanation,
      insights,
    };
  }

  private async evaluate(input: EvaluateInput): Promise<EvaluationOutput> {
    const systemPrompt = `You are a query result evaluator. Determine if the execution result fully satisfies the user's original query.

Rules:
- Analyze if the data returned actually answers what the user asked
- Consider if the result is empty when it shouldn't be
- Consider if the wrong columns or aggregations were used
- Consider if the data needs further transformation or filtering
- Be strict but fair in evaluation

Output format: Return a JSON object with:
- satisfiesQuery: boolean (true if result fully answers the query)
- reason: string (brief explanation of why it does or doesn't satisfy)
- suggestedRefinement: string (optional, only if satisfiesQuery is false - suggest how to improve the query)

Return ONLY the JSON object, no markdown or extra text.`;

    const resultStr = JSON.stringify(input.executionResult, null, 2).substring(0, 2000);

    const responseText = await this.chat(
      systemPrompt,
      `Original Query: "${input.query}"\n\nExecution Result:\n${resultStr}\n\nGenerated Explanation: ${input.explanation}`,
      { temperature: 0.3, maxTokens: 500 },
    );

    try {
      // Try to parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          satisfiesQuery: Boolean(parsed.satisfiesQuery),
          reason: String(parsed.reason || 'No reason provided'),
          suggestedRefinement: parsed.suggestedRefinement ? String(parsed.suggestedRefinement) : undefined,
        };
      }
    } catch {
      // If parsing fails, assume it's satisfied
    }

    return {
      satisfiesQuery: true,
      reason: 'Unable to parse evaluation, assuming query is satisfied',
    };
  }
}
