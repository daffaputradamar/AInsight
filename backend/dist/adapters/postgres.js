import { Pool } from 'pg';
// Store only configs per session (NOT connections)
const sessionConfigStore = new Map();
// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;
// Cleanup interval (5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
/**
 * Get config for a session
 */
export function getSessionConfig(sessionId) {
    const info = sessionConfigStore.get(sessionId);
    if (info) {
        info.lastAccess = new Date();
        return info.config;
    }
    return null;
}
/**
 * Set config for a session
 */
export function setSessionConfig(sessionId, config) {
    sessionConfigStore.set(sessionId, {
        config,
        lastAccess: new Date(),
    });
    console.log(`[SessionConfig] Stored config for session: ${sessionId}`);
}
/**
 * Check if a session has a configured database
 */
export function hasSessionConfig(sessionId) {
    return sessionConfigStore.has(sessionId);
}
/**
 * Remove a session's config
 */
export function removeSessionConfig(sessionId) {
    sessionConfigStore.delete(sessionId);
    console.log(`[SessionConfig] Removed config for session: ${sessionId}`);
}
/**
 * Cleanup expired session configs
 */
function cleanupExpiredConfigs() {
    const now = Date.now();
    const expiredSessions = [];
    sessionConfigStore.forEach((info, sessionId) => {
        if (now - info.lastAccess.getTime() > SESSION_TIMEOUT) {
            expiredSessions.push(sessionId);
        }
    });
    for (const sessionId of expiredSessions) {
        removeSessionConfig(sessionId);
        console.log(`[SessionConfig] Cleaned up expired session: ${sessionId}`);
    }
}
// Start cleanup interval
setInterval(cleanupExpiredConfigs, CLEANUP_INTERVAL);
const schemaCache = new Map();
const SCHEMA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
function getConfigHash(config) {
    return `${config.host}:${config.port}:${config.database}:${config.user}`;
}
function getCachedSchema(config) {
    const hash = getConfigHash(config);
    const entry = schemaCache.get(hash);
    if (entry && Date.now() - entry.timestamp.getTime() < SCHEMA_CACHE_TTL) {
        console.log(`[SchemaCache] Cache hit for ${hash}`);
        return entry.schema;
    }
    return null;
}
function setCachedSchema(config, schema) {
    const hash = getConfigHash(config);
    schemaCache.set(hash, { schema, timestamp: new Date() });
    console.log(`[SchemaCache] Cached schema for ${hash}`);
}
// =============================================================================
// PostgreSQL Adapter - Ephemeral connections (connect -> operation -> disconnect)
// =============================================================================
export class PostgreSQLAdapter {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Get current connection config (without password for security)
     */
    getConfig() {
        return {
            host: this.config.host,
            port: this.config.port,
            database: this.config.database,
            user: this.config.user,
        };
    }
    /**
     * Execute an operation with a temporary connection
     * Opens connection -> runs operation -> closes connection
     */
    async withConnection(operation) {
        const pool = new Pool(this.config);
        console.log(`[PostgreSQL] Opened connection to ${this.config.host}:${this.config.database}`);
        try {
            const result = await operation(pool);
            return result;
        }
        finally {
            await pool.end();
            console.log(`[PostgreSQL] Closed connection to ${this.config.host}:${this.config.database}`);
        }
    }
    /**
     * Test the database connection
     */
    async testConnection() {
        await this.withConnection(async (pool) => {
            const client = await pool.connect();
            client.release();
            console.log('[PostgreSQL] Connection test successful');
        });
    }
    /**
     * Get schema metadata (uses cache if available)
     */
    async getSchemaMetadata() {
        // Check cache first
        const cached = getCachedSchema(this.config);
        if (cached) {
            return cached;
        }
        // Fetch fresh schema
        const schema = await this.withConnection(async (pool) => {
            const client = await pool.connect();
            try {
                const tablesQuery = `
          SELECT tablename FROM pg_tables 
          WHERE schemaname = 'public'
        `;
                const tablesResult = await client.query(tablesQuery);
                const tableNames = tablesResult.rows.map((row) => row.tablename);
                const tables = [];
                for (const tableName of tableNames) {
                    const columnsQuery = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = $1
          `;
                    const columnsResult = await client.query(columnsQuery, [tableName]);
                    const rowCountQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
                    const rowCountResult = await client.query(rowCountQuery);
                    tables.push({
                        name: tableName,
                        columns: columnsResult.rows.map((row) => ({
                            name: row.column_name,
                            type: row.data_type,
                            nullable: row.is_nullable === 'YES',
                        })),
                        rowCount: parseInt(rowCountResult.rows[0].count),
                    });
                }
                return {
                    tables,
                    lastUpdated: new Date(),
                };
            }
            finally {
                client.release();
            }
        });
        // Cache the result
        setCachedSchema(this.config, schema);
        return schema;
    }
    /**
     * Execute a SQL query
     */
    async executeQuery(sql, params = []) {
        return this.withConnection(async (pool) => {
            const client = await pool.connect();
            try {
                const result = await client.query(sql, params);
                return result.rows;
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Execute a safe (read-only) SQL query
     */
    async executeSafeQuery(sql, params = []) {
        // Validate SQL to prevent dangerous operations
        const forbiddenPatterns = [/DROP\s+TABLE/i, /DELETE\s+FROM/i, /TRUNCATE/i, /ALTER\s+TABLE/i];
        for (const pattern of forbiddenPatterns) {
            if (pattern.test(sql)) {
                throw new Error('Dangerous SQL operation detected. Read-only queries only.');
            }
        }
        return this.executeQuery(sql, params);
    }
}
// =============================================================================
// Helper functions for server.ts
// =============================================================================
/**
 * Create an adapter for a session (if config exists)
 */
export function createAdapterForSession(sessionId) {
    const config = getSessionConfig(sessionId);
    if (!config) {
        return null;
    }
    return new PostgreSQLAdapter(config);
}
/**
 * Test and store a database configuration for a session
 */
export async function configureSession(sessionId, config) {
    // Create temporary adapter to test connection
    const adapter = new PostgreSQLAdapter(config);
    await adapter.testConnection();
    // If test passes, store the config
    setSessionConfig(sessionId, config);
}
//# sourceMappingURL=postgres.js.map