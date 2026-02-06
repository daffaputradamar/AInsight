/**
 * ADK.js Agent Base Class
 *
 * This module provides the foundational Agent class for building
 * multi-agent systems. Agents encapsulate LLM-powered tools and
 * can be orchestrated in deterministic sequential loops.
 */

import OpenAI from 'openai';
import { z, ZodSchema } from 'zod';

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: ZodSchema<TInput>;
  outputSchema?: ZodSchema<TOutput>;
  handler: (input: TInput) => Promise<TOutput>;
}

export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentContext {
  llm: OpenAI;
  config: AgentConfig;
  metadata?: Record<string, unknown>;
}

export interface AgentRunResult<T = unknown> {
  success: boolean;
  output?: T;
  error?: string;
  executionTime: number;
  agentName: string;
  timestamp: Date;
}

/**
 * Base Agent class for ADK.js
 *
 * Extend this class to create specialized agents with tools.
 * Each agent has access to an LLM client and can define multiple tools.
 */
export abstract class Agent {
  protected llm: OpenAI;
  protected config: AgentConfig;
  protected tools: Map<string, ToolDefinition> = new Map();

  constructor(context: AgentContext) {
    this.llm = context.llm;
    this.config = context.config;
    this.registerTools();
  }

  /**
   * Override this method to register tools for the agent
   */
  protected abstract registerTools(): void;

  /**
   * Get agent name
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Get agent description
   */
  get description(): string {
    return this.config.description;
  }

  /**
   * Register a tool with the agent
   */
  protected registerTool<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
    this.tools.set(tool.name, tool as ToolDefinition);
  }

  /**
   * Execute a tool by name
   */
  async executeTool<TInput, TOutput>(toolName: string, input: TInput): Promise<AgentRunResult<TOutput>> {
    const startTime = Date.now();
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool '${toolName}' not found`,
        executionTime: Date.now() - startTime,
        agentName: this.name,
        timestamp: new Date(),
      };
    }

    try {
      // Validate input
      const validatedInput = tool.inputSchema.parse(input);

      // Execute handler
      const output = await tool.handler(validatedInput);

      // Validate output if schema provided
      if (tool.outputSchema) {
        tool.outputSchema.parse(output);
      }

      return {
        success: true,
        output: output as TOutput,
        executionTime: Date.now() - startTime,
        agentName: this.name,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
        agentName: this.name,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Make an LLM chat completion call
   */
  protected async chat(
    systemPrompt: string,
    userMessage: string,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    try {
      const response = await this.llm.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 2000,
      });

      const content = response.choices[0]?.message?.content ?? '';
      
      if (!content) {
        console.warn(`[${this.config.name}] Empty LLM response`);
      }
      
      return content;
    } catch (error) {
      console.error(`[${this.config.name}] LLM call failed:`, error);
      throw error;
    }
  }

  /**
   * Make an LLM chat completion call with JSON response format
   */
  protected async chatJSON<T>(
    systemPrompt: string,
    userMessage: string,
    schema: ZodSchema<T>,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<T> {
    const response = await this.chat(systemPrompt, userMessage, options);

    if (!response || response.trim() === '') {
      throw new Error('LLM returned empty response. Check if LiteLLM proxy is running and API key is valid.');
    }

    // Try to extract JSON from markdown code blocks
    let jsonStr = response;
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    } else {
      // Try to find JSON object in response
      const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonStr = jsonObjectMatch[0];
      }
    }

    try {
      const trimmed = jsonStr.trim();
      if (!trimmed) {
        throw new Error('No JSON content found in response');
      }
      const parsed = JSON.parse(trimmed);
      return schema.parse(parsed);
    } catch (error) {
      console.error(`[${this.config.name}] Failed to parse response:`, response);
      throw new Error(`Failed to parse LLM response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all registered tools
   */
  getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
}

/**
 * Tool configuration type for defining agent tools
 *
 * Note: Decorators require experimental support. For production use,
 * register tools manually via registerTool() in registerTools().
 */
export interface ToolConfig<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: ZodSchema<TInput>;
  outputSchema?: ZodSchema<TOutput>;
}

/**
 * Helper to create tool definitions with type inference
 */
export function defineTool<TInput, TOutput>(
  config: ToolConfig<TInput, TOutput>,
  handler: (input: TInput) => Promise<TOutput>,
): ToolDefinition<TInput, TOutput> {
  return {
    ...config,
    handler,
  };
}

// Re-export zod for convenience
export { z } from 'zod';
