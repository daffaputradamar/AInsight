import OpenAI from 'openai';
export interface LLMConfig {
    apiKey: string;
    baseURL: string;
    model: string;
    temperature: number;
    maxTokens: number;
    /** Enable reasoning/thinking mode if model supports it */
    enableReasoning: boolean;
}
/**
 * Model presets for common configurations
 * Swap models without app restart by changing AI_MODEL env var
 */
export declare const MODEL_PRESETS: Record<string, Partial<LLMConfig>>;
/**
 * Available models for frontend selection
 */
export declare const AVAILABLE_MODELS: {
    id: string;
    name: string;
    model: string;
}[];
export declare const createLLMClient: (modelOverride?: string) => OpenAI;
export declare const getLLMConfig: (modelOverride?: string) => LLMConfig;
/**
 * Helper to create agent-specific config overrides
 */
export declare const getAgentConfig: (agentName: string, overrides?: Partial<LLMConfig>) => LLMConfig;
//# sourceMappingURL=llm.d.ts.map