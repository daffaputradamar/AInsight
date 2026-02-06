/**
 * MCP (Model Context Protocol) Adapter
 *
 * This module provides MCP client implementation following the official protocol.
 * Supports stdio and SSE transports for connecting to MCP servers.
 * Based on agent-builder implementation pattern.
 */
import { spawn } from 'child_process';
// ============================================================================
// Stdio Transport Connection
// ============================================================================
class MCPStdioConnection {
    config;
    process = null;
    requestId = 0;
    pendingRequests = new Map();
    buffer = '';
    constructor(config) {
        this.config = config;
    }
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.process = spawn(this.config.command, this.config.args || [], {
                    env: { ...process.env, ...this.config.env },
                    cwd: this.config.cwd,
                    stdio: ['pipe', 'pipe', 'pipe'],
                });
                this.process.stdout?.on('data', (data) => {
                    this.handleData(data.toString());
                });
                this.process.stderr?.on('data', (data) => {
                    console.error('[MCP Stdio] Server stderr:', data.toString());
                });
                this.process.on('error', (err) => {
                    console.error('[MCP Stdio] Process error:', err);
                    reject(err);
                });
                this.process.on('close', (code) => {
                    console.log('[MCP Stdio] Process closed with code:', code);
                    this.cleanup();
                });
                // MCP protocol handshake
                this.sendRequest('initialize', {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: {},
                    },
                    clientInfo: {
                        name: 'ainsight-adk-agent',
                        version: '1.0.0',
                    },
                })
                    .then(() => {
                    // Send initialized notification
                    this.sendNotification('notifications/initialized');
                    resolve();
                })
                    .catch(reject);
            }
            catch (err) {
                reject(err);
            }
        });
    }
    handleData(data) {
        this.buffer += data;
        // Process complete JSON-RPC messages (newline-delimited)
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                const response = JSON.parse(line);
                const pending = this.pendingRequests.get(response.id);
                if (pending) {
                    this.pendingRequests.delete(response.id);
                    if (response.error) {
                        pending.reject(new Error(response.error.message));
                    }
                    else {
                        pending.resolve(response);
                    }
                }
            }
            catch (err) {
                console.error('[MCP Stdio] Failed to parse response:', line, err);
            }
        }
    }
    async sendRequest(method, params) {
        if (!this.process?.stdin) {
            throw new Error('MCP stdio connection not established');
        }
        const id = ++this.requestId;
        const request = {
            jsonrpc: '2.0',
            id,
            method,
            params,
        };
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            const message = JSON.stringify(request) + '\n';
            this.process.stdin.write(message, (err) => {
                if (err) {
                    this.pendingRequests.delete(id);
                    reject(err);
                }
            });
            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`MCP request ${method} timed out`));
                }
            }, 30000);
        });
    }
    sendNotification(method, params) {
        if (!this.process?.stdin)
            return;
        const notification = {
            jsonrpc: '2.0',
            method,
            params,
        };
        this.process.stdin.write(JSON.stringify(notification) + '\n');
    }
    cleanup() {
        for (const [id, pending] of this.pendingRequests) {
            pending.reject(new Error('Connection closed'));
        }
        this.pendingRequests.clear();
        this.process = null;
    }
    async disconnect() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        this.cleanup();
    }
    isConnected() {
        return this.process !== null && !this.process.killed;
    }
}
// ============================================================================
// SSE Transport Connection
// ============================================================================
class MCPSSEConnection {
    config;
    sessionUrl = null;
    requestId = 0;
    headers;
    constructor(config) {
        this.config = config;
        this.headers = config.headers || {};
    }
    async connect() {
        this.sessionUrl = this.config.url;
        // MCP protocol handshake
        await this.sendRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: {},
            },
            clientInfo: {
                name: 'ainsight-adk-agent',
                version: '1.0.0',
            },
        });
        console.log('[MCP SSE] Connected to', this.sessionUrl);
    }
    async sendRequest(method, params) {
        if (!this.sessionUrl) {
            throw new Error('MCP SSE connection not established');
        }
        const id = ++this.requestId;
        const request = {
            jsonrpc: '2.0',
            id,
            method,
            params,
        };
        const response = await fetch(this.sessionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...this.headers,
            },
            body: JSON.stringify(request),
        });
        if (!response.ok) {
            throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
        }
        const result = (await response.json());
        if (result.error) {
            throw new Error(result.error.message);
        }
        return result;
    }
    async disconnect() {
        this.sessionUrl = null;
    }
    isConnected() {
        return this.sessionUrl !== null;
    }
}
// ============================================================================
// MCP Client
// ============================================================================
/**
 * MCPClient manages connections to MCP servers and executes tools
 */
export class MCPClient {
    connections = new Map();
    /**
     * Connect to an MCP server
     */
    async connect(server) {
        if (this.connections.has(server.id)) {
            console.log(`[MCP] Already connected to ${server.name}`);
            return;
        }
        let connection;
        switch (server.transport) {
            case 'stdio':
                connection = new MCPStdioConnection(server.config);
                break;
            case 'sse':
                connection = new MCPSSEConnection(server.config);
                break;
            default:
                throw new Error(`Unknown transport: ${server.transport}`);
        }
        await connection.connect();
        this.connections.set(server.id, connection);
        console.log(`[MCP] Connected to server: ${server.name} (${server.id})`);
    }
    /**
     * Disconnect from an MCP server
     */
    async disconnect(serverId) {
        const connection = this.connections.get(serverId);
        if (connection) {
            await connection.disconnect();
            this.connections.delete(serverId);
            console.log(`[MCP] Disconnected from server: ${serverId}`);
        }
    }
    /**
     * Disconnect from all MCP servers
     */
    async disconnectAll() {
        const disconnectPromises = Array.from(this.connections.keys()).map((id) => this.disconnect(id));
        await Promise.all(disconnectPromises);
    }
    /**
     * Check if connected to a server
     */
    isConnected(serverId) {
        return this.connections.get(serverId)?.isConnected() ?? false;
    }
    /**
     * List available tools from an MCP server
     */
    async listTools(serverId) {
        const connection = this.connections.get(serverId);
        if (!connection) {
            throw new Error(`Not connected to server ${serverId}`);
        }
        const response = await connection.sendRequest('tools/list');
        if (response.error) {
            throw new Error(response.error.message);
        }
        const result = response.result;
        return result.tools.map((tool) => ({
            id: `${serverId}-${tool.name}`,
            serverId,
            name: tool.name,
            description: tool.description,
            inputSchema: JSON.stringify(tool.inputSchema),
        }));
    }
    /**
     * Call a tool on an MCP server
     */
    async callTool(serverId, toolName, args) {
        const connection = this.connections.get(serverId);
        if (!connection) {
            throw new Error(`Not connected to server ${serverId}`);
        }
        console.log(`[MCP] Calling tool ${toolName} on server ${serverId}:`, JSON.stringify(args));
        const response = await connection.sendRequest('tools/call', {
            name: toolName,
            arguments: args,
        });
        if (response.error) {
            throw new Error(response.error.message);
        }
        const result = response.result;
        if (result.isError) {
            const errorContent = result.content.find((c) => c.type === 'text');
            throw new Error(errorContent?.text || 'Unknown error from tool');
        }
        // Combine all text content
        const textContent = result.content
            .filter((c) => c.type === 'text')
            .map((c) => c.text)
            .join('\n');
        const resultText = textContent || JSON.stringify(result.content);
        console.log(`[MCP] Tool ${toolName} result:`, resultText.substring(0, 500));
        return resultText;
    }
}
// ============================================================================
// Singleton Instance
// ============================================================================
let mcpClientInstance = null;
/**
 * Get the singleton MCP client instance
 */
export function getMCPClient() {
    if (!mcpClientInstance) {
        mcpClientInstance = new MCPClient();
    }
    return mcpClientInstance;
}
/**
 * Create a new MCP client instance (for testing or isolation)
 */
export function createMCPClient() {
    return new MCPClient();
}
/**
 * Test MCP server connection
 */
export async function testMCPConnection(server) {
    const client = new MCPClient();
    try {
        await client.connect(server);
        const tools = await client.listTools(server.id);
        await client.disconnect(server.id);
        return {
            success: true,
            tools,
        };
    }
    catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
/**
 * NullMCPClient for when MCP is not configured
 */
export class NullMCPClient {
    async connect() {
        console.warn('[MCP] NullMCPClient: MCP is not configured');
    }
    async disconnect() { }
    isConnected() {
        return false;
    }
    async callTool() {
        throw new Error('MCP not configured');
    }
}
//# sourceMappingURL=mcp.js.map