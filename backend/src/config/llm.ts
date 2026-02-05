import OpenAI from 'openai';

export interface LLMConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export const createLLMClient = (): OpenAI => {
  const config: LLMConfig = {
    apiKey: process.env.AI_API_KEY || '',
    baseURL: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.AI_MODEL || 'gpt-4o',
    temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.MAX_TOKENS || '2000'),
  };

  if (!config.apiKey) {
    throw new Error('AI_API_KEY environment variable is required');
  }

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
};

export const getLLMConfig = (): LLMConfig => ({
  apiKey: process.env.AI_API_KEY || '',
  baseURL: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
  model: process.env.AI_MODEL || 'gpt-4o',
  temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
  maxTokens: parseInt(process.env.MAX_TOKENS || '2000'),
});
