/**
 * MCP (Model Context Protocol) Adapter
 *
 * This module provides MCP client implementation following the official protocol.
 * Supports stdio and SSE transports for connecting to MCP servers.
 * Based on agent-builder implementation pattern.
 */
export type MCPTransport = 'stdio' | 'sse';
export type MCPServerStatus = 'active' | 'inactive' | 'error';
export interface MCPStdioConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
}
export interface MCPSSEConfig {
    url: string;
    headers?: Record<string, string>;
}
export type MCPConfig = MCPStdioConfig | MCPSSEConfig;
export interface MCPServerConfig {
    id: string;
    name: string;
    description?: string;
    transport: MCPTransport;
    config: MCPConfig;
}
export interface MCPTool {
    id: string;
    serverId: string;
    name: string;
    description?: string;
    inputSchema: string;
}
/**
 * MCPClient manages connections to MCP servers and executes tools
 */
export declare class MCPClient {
    private connections;
    /**
     * Connect to an MCP server
     */
    connect(server: MCPServerConfig): Promise<void>;
    /**
     * Disconnect from an MCP server
     */
    disconnect(serverId: string): Promise<void>;
    /**
     * Disconnect from all MCP servers
     */
    disconnectAll(): Promise<void>;
    /**
     * Check if connected to a server
     */
    isConnected(serverId: string): boolean;
    /**
     * List available tools from an MCP server
     */
    listTools(serverId: string): Promise<MCPTool[]>;
    /**
     * Call a tool on an MCP server
     */
    callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<string>;
}
/**
 * Get the singleton MCP client instance
 */
export declare function getMCPClient(): MCPClient;
/**
 * Create a new MCP client instance (for testing or isolation)
 */
export declare function createMCPClient(): MCPClient;
/**
 * Test MCP server connection
 */
export declare function testMCPConnection(server: MCPServerConfig): Promise<{
    success: boolean;
    tools?: MCPTool[];
    error?: string;
}>;
export interface IMCPClient {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    callTool<TInput, TOutput>(toolName: string, input: TInput): Promise<TOutput>;
}
/**
 * NullMCPClient for when MCP is not configured
 */
export declare class NullMCPClient implements IMCPClient {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    callTool(): Promise<never>;
}
//# sourceMappingURL=mcp.d.ts.map