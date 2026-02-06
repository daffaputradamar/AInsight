import { Agent, z } from '../adk/index.js';
const ClassifyInputSchema = z.object({
    query: z.string().describe('User natural language query'),
});
const ClassifyOutputSchema = z.object({
    requiresDatabase: z.boolean(),
    shouldVisualize: z.boolean(),
    intent: z.string(),
    chatResponse: z.string().optional(),
});
/**
 * QueryUnderstandingAgent
 *
 * Classifies user intent and determines if visualization is needed.
 * Uses LLM classification (NOT keyword heuristics).
 * Responds strictly with true or false for shouldVisualize.
 */
export class QueryUnderstandingAgent extends Agent {
    constructor(context) {
        super({
            ...context,
            config: {
                ...context.config,
                name: 'query-understanding',
                description: 'Classifies user query intent and visualization requirements',
            },
        });
    }
    registerTools() {
        this.registerTool({
            name: 'classify',
            description: 'Classify user query intent and determine visualization needs',
            inputSchema: ClassifyInputSchema,
            outputSchema: ClassifyOutputSchema,
            handler: this.classify.bind(this),
        });
    }
    async classify(input) {
        // Try LLM classification first
        try {
            const systemPrompt = `You are an intent classifier for a database analysis assistant called AInsight.

Given a user query, determine:
1. If it requires database access (data queries, analysis, reports, etc.) OR is just casual chat (greetings, general questions about capabilities, small talk)
2. If database queries would benefit from visualization

Respond ONLY with valid JSON in this exact format:
{
  "requiresDatabase": true or false,
  "shouldVisualize": true or false,
  "intent": "brief description of intent",
  "chatResponse": "only if requiresDatabase is false, provide a friendly response"
}

Rules:
- requiresDatabase: true for ANY data-related query (show me, count, list, analyze, what are, how many, etc.)
- requiresDatabase: false for greetings, "hello", "hi", "what can you do", "help", general questions about the assistant
- If requiresDatabase is false, provide a helpful chatResponse as AInsight assistant
- shouldVisualize: true if user wants charts, graphs, trends, comparisons
- Keep chatResponse concise and helpful`;
            const result = await this.chatJSON(systemPrompt, input.query, ClassifyOutputSchema, { temperature: 0.3, maxTokens: 300 });
            return {
                requiresDatabase: Boolean(result.requiresDatabase),
                shouldVisualize: Boolean(result.shouldVisualize),
                intent: result.intent || 'analysis',
                chatResponse: result.chatResponse,
            };
        }
        catch (error) {
            console.error('[QueryUnderstandingAgent] LLM classification failed, using heuristic:', error);
            // Fallback: Use keyword-based heuristics
            const lowerQuery = input.query.toLowerCase().trim();
            // Check if it's casual chat
            const casualPatterns = [
                /^(hi|hello|hey|howdy|greetings)/i,
                /^what can you do/i,
                /^how do (i|you)/i,
                /^help$/i,
                /^(thanks|thank you|thx)/i,
                /^(bye|goodbye|see you)/i,
                /^who are you/i,
                /^what are you/i,
            ];
            const isCasualChat = casualPatterns.some(pattern => pattern.test(lowerQuery));
            if (isCasualChat) {
                return {
                    requiresDatabase: false,
                    shouldVisualize: false,
                    intent: 'casual_chat',
                    chatResponse: this.getDefaultChatResponse(lowerQuery),
                };
            }
            const visualKeywords = ['chart', 'graph', 'plot', 'visualize', 'show', 'display', 'histogram', 'timeline', 'trend', 'compare', 'breakdown'];
            const shouldVisualize = visualKeywords.some(keyword => lowerQuery.includes(keyword));
            return {
                requiresDatabase: true,
                shouldVisualize,
                intent: this.inferIntent(lowerQuery),
            };
        }
    }
    getDefaultChatResponse(query) {
        if (/^(hi|hello|hey|howdy|greetings)/i.test(query)) {
            return "Hello! I'm AInsight, your AI-powered database analysis assistant. I can help you query and analyze your data using natural language. Try asking me something like 'Show me the top 10 customers by revenue' or 'What are the sales trends this month?'";
        }
        if (/^what can you do/i.test(query) || /^help$/i.test(query)) {
            return "I can help you analyze your database using natural language queries. Just describe what data you want to see, and I'll generate the appropriate SQL, execute it, and explain the results. I can also create visualizations for trends and comparisons. Try asking questions like 'Count records by category' or 'Show monthly sales trends'.";
        }
        if (/^(thanks|thank you|thx)/i.test(query)) {
            return "You're welcome! Feel free to ask if you have more questions about your data.";
        }
        if (/^(bye|goodbye|see you)/i.test(query)) {
            return "Goodbye! Feel free to come back anytime you need help analyzing your data.";
        }
        if (/^who are you/i.test(query) || /^what are you/i.test(query)) {
            return "I'm AInsight, an AI-powered data analysis assistant. I help you explore and understand your database through natural language conversations. Just ask me questions about your data!";
        }
        return "I'm here to help you analyze your data. Try asking a question about your database, like 'What are the top selling products?' or 'Show me customer trends'.";
    }
    inferIntent(query) {
        if (query.includes('count') || query.includes('how many'))
            return 'counting';
        if (query.includes('sum') || query.includes('total'))
            return 'aggregation';
        if (query.includes('average') || query.includes('mean'))
            return 'statistical';
        if (query.includes('trend') || query.includes('over time'))
            return 'temporal';
        if (query.includes('compare') || query.includes('difference'))
            return 'comparison';
        return 'analysis';
    }
}
//# sourceMappingURL=QueryUnderstandingAgent.js.map