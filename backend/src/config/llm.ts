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
export const MODEL_PRESETS: Record<string, Partial<LLMConfig>> = {
  'gpt-oss-20b': {
    model: 'hosted_vllm/openai/gpt-oss-20b',
    temperature: 0.7,
    maxTokens: 4096,
  },
  'gemini-3-flash': {
    model: 'gemini/gemini-3-flash-preview',
    temperature: 0.7,
    maxTokens: 4096,
  },
  'gemini-2.0-flash': {
    model: 'gemini/gemini-2.0-flash',
    temperature: 0.7,
    maxTokens: 4096,
  },
  'gemini-pro': {
    model: 'gemini/gemini-pro',
    temperature: 0.7,
    maxTokens: 2048,
  },
  'gpt-4o': {
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
  },
  'gpt-4o-mini': {
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 4096,
  },
  'claude-3-5-sonnet': {
    model: 'anthropic/claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 4096,
  },
};

/**
 * Available models for frontend selection
 */
export const AVAILABLE_MODELS = [
  { id: 'gpt-oss-20b', name: 'GPT-OSS-20B', model: 'hosted_vllm/openai/gpt-oss-20b' },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', model: 'gemini/gemini-3-flash-preview' },
];

export const createLLMClient = (modelOverride?: string): OpenAI => {
  const config = getLLMConfig(modelOverride);

  if (!config.apiKey) {
    throw new Error('AI_API_KEY environment variable is required');
  }

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
};

export const getLLMConfig = (modelOverride?: string): LLMConfig => {
  const preset = process.env.AI_MODEL_PRESET;
  const presetConfig = preset ? MODEL_PRESETS[preset] : {};
  
  // Check if modelOverride matches a preset
  const overridePreset = modelOverride ? MODEL_PRESETS[modelOverride] : null;
  const finalModel = overridePreset?.model || modelOverride || process.env.AI_MODEL || presetConfig.model || 'gemini/gemini-2.0-flash';

  return {
    apiKey: process.env.AI_API_KEY || '',
    baseURL: process.env.AI_BASE_URL || 'http://localhost:4000/v1', // LiteLLM default
    model: finalModel,
    temperature: parseFloat(process.env.AI_TEMPERATURE || String(overridePreset?.temperature ?? presetConfig.temperature ?? 0.7)),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || String(overridePreset?.maxTokens ?? presetConfig.maxTokens ?? 2000)),
    enableReasoning: process.env.AI_ENABLE_REASONING === 'true',
  };
};

/**
 * Helper to create agent-specific config overrides
 */
export const getAgentConfig = (agentName: string, overrides?: Partial<LLMConfig>): LLMConfig => {
  const baseConfig = getLLMConfig();

  // Agent-specific environment variables
  const envPrefix = `AI_${agentName.toUpperCase().replace(/-/g, '_')}`;
  const agentModel = process.env[`${envPrefix}_MODEL`];
  const agentTemp = process.env[`${envPrefix}_TEMPERATURE`];
  const agentMaxTokens = process.env[`${envPrefix}_MAX_TOKENS`];

  return {
    ...baseConfig,
    ...(agentModel && { model: agentModel }),
    ...(agentTemp && { temperature: parseFloat(agentTemp) }),
    ...(agentMaxTokens && { maxTokens: parseInt(agentMaxTokens) }),
    ...overrides,
  };
};
