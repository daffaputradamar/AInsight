/**
 * ADK.js Agent Base Class
 *
 * This module provides the foundational Agent class for building
 * multi-agent systems. Agents encapsulate LLM-powered tools and
 * can be orchestrated in deterministic sequential loops.
 */
import OpenAI from 'openai';
import { ZodSchema } from 'zod';
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
export declare abstract class Agent {
    protected llm: OpenAI;
    protected config: AgentConfig;
    protected tools: Map<string, ToolDefinition>;
    constructor(context: AgentContext);
    /**
     * Override this method to register tools for the agent
     */
    protected abstract registerTools(): void;
    /**
     * Get agent name
     */
    get name(): string;
    /**
     * Get agent description
     */
    get description(): string;
    /**
     * Register a tool with the agent
     */
    protected registerTool<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void;
    /**
     * Execute a tool by name
     */
    executeTool<TInput, TOutput>(toolName: string, input: TInput): Promise<AgentRunResult<TOutput>>;
    /**
     * Make an LLM chat completion call
     */
    protected chat(systemPrompt: string, userMessage: string, options?: {
        temperature?: number;
        maxTokens?: number;
    }): Promise<string>;
    /**
     * Make an LLM chat completion call with JSON response format
     */
    protected chatJSON<T>(systemPrompt: string, userMessage: string, schema: ZodSchema<T>, options?: {
        temperature?: number;
        maxTokens?: number;
    }): Promise<T>;
    /**
     * List all registered tools
     */
    getTools(): ToolDefinition[];
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
export declare function defineTool<TInput, TOutput>(config: ToolConfig<TInput, TOutput>, handler: (input: TInput) => Promise<TOutput>): ToolDefinition<TInput, TOutput>;
export { z } from 'zod';
//# sourceMappingURL=Agent.d.ts.map