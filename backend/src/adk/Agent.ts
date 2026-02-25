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

    // Try to extract JSON from various formats
    let jsonStr = response.trim();
    
    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
    
    // If still doesn't start with { or [, try to find JSON object/array
    if (!jsonStr.startsWith('{') && !jsonStr.startsWith('[')) {
      // Find first { or [
      const startIdx = Math.min(
        jsonStr.indexOf('{') >= 0 ? jsonStr.indexOf('{') : Infinity,
        jsonStr.indexOf('[') >= 0 ? jsonStr.indexOf('[') : Infinity
      );
      if (startIdx !== Infinity) {
        jsonStr = jsonStr.substring(startIdx);
      }
    }

    // Try to parse, and if it fails, try to fix by finding matching braces
    let parsed: unknown;
    try {
      if (!jsonStr || (!jsonStr.startsWith('{') && !jsonStr.startsWith('['))) {
        throw new Error('No JSON object or array found in response');
      }
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      // Try to find a complete JSON object by counting braces
      const isObject = jsonStr.startsWith('{');
      const openChar = isObject ? '{' : '[';
      const closeChar = isObject ? '}' : ']';
      
      let braceCount = 0;
      let endIdx = 0;
      let inString = false;
      let escapeNext = false;
      
      for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr[i];
        
        // Track if we're inside a string to avoid counting braces in strings
        if (char === '"' && !escapeNext) {
          inString = !inString;
        }
        escapeNext = char === '\\' && !escapeNext;
        
        if (!inString) {
          if (char === openChar) braceCount++;
          if (char === closeChar) braceCount--;
          
          // Found balanced braces — end of JSON object
          if (braceCount === 0 && i > 0) {
            endIdx = i + 1;
            break;
          }
        }
      }
      
      // If we found balanced braces, try parsing that portion
      if (endIdx > 0) {
        try {
          parsed = JSON.parse(jsonStr.substring(0, endIdx));
        } catch (innerError) {
          // Partial JSON couldn't be recovered — try healing
          parsed = this.healPartialJSON(jsonStr, isObject);
        }
      } else {
        // No balanced braces found — try healing the partial JSON
        parsed = this.healPartialJSON(jsonStr, isObject);
      }
      
      // If healing failed, log and throw
      if (!parsed) {
        console.error(`[${this.config.name}] Failed to parse response:`, response);
        throw new Error(`Failed to parse LLM response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
    }

    return schema.parse(parsed);
  }

  /**
   * Attempt to heal truncated/incomplete JSON by closing unclosed strings and braces.
   * Returns the parsed object if successful, null otherwise.
   */
  private healPartialJSON(jsonStr: string, isObject: boolean): unknown | null {
    try {
      // Try increasingly healing strategies
      let healed = jsonStr;
      
      // Strategy 1: Check if we just have an unclosed string at the end
      const lastQuoteIdx = healed.lastIndexOf('"');
      if (lastQuoteIdx > -1 && lastQuoteIdx < healed.length - 1) {
        // There's content after the last quote — likely unterminated
        healed = healed.substring(0, lastQuoteIdx + 1);
      } else if (lastQuoteIdx === healed.length - 1 && !this.isStringTerminated(healed)) {
        // String is unterminated, close it
        healed += '"';
      }
      
      // Strategy 2: Add missing closing braces/brackets
      let openCount = 0, closeCount = 0;
      let inString = false, escapeNext = false;
      for (let i = 0; i < healed.length; i++) {
        const char = healed[i];
        if (char === '"' && !escapeNext) inString = !inString;
        escapeNext = char === '\\' && !escapeNext;
        if (!inString) {
          if (isObject && char === '{') openCount++;
          if (isObject && char === '}') closeCount++;
          if (!isObject && char === '[') openCount++;
          if (!isObject && char === ']') closeCount++;
        }
      }
      
      const closeChar = isObject ? '}' : ']';
      while (closeCount < openCount) {
        healed += closeChar;
        closeCount++;
      }
      
      // Try parsing the healed JSON
      return JSON.parse(healed);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if a string (up to the end) is properly terminated.
   */
  private isStringTerminated(str: string): boolean {
    let escaped = false;
    for (let i = str.length - 1; i >= 0; i--) {
      const char = str[i];
      if (char === '"' && !escaped) {
        return true; // Found unescaped closing quote
      }
      if (char === '\\') {
        escaped = !escaped;
      } else {
        escaped = false;
      }
    }
    return false;
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
