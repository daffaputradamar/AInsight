export interface TableSchema {
    name: string;
    columns: ColumnSchema[];
    rowCount: number;
}
export interface ColumnSchema {
    name: string;
    type: string;
    nullable: boolean;
}
export interface SchemaMetadata {
    tables: TableSchema[];
    lastUpdated: Date;
}
export interface DbConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
}
/**
 * Get config for a session
 */
export declare function getSessionConfig(sessionId: string): DbConfig | null;
/**
 * Set config for a session
 */
export declare function setSessionConfig(sessionId: string, config: DbConfig): void;
/**
 * Check if a session has a configured database
 */
export declare function hasSessionConfig(sessionId: string): boolean;
/**
 * Remove a session's config
 */
export declare function removeSessionConfig(sessionId: string): void;
export declare class PostgreSQLAdapter {
    private config;
    constructor(config: DbConfig);
    /**
     * Get current connection config (without password for security)
     */
    getConfig(): Omit<DbConfig, 'password'>;
    /**
     * Execute an operation with a temporary connection
     * Opens connection -> runs operation -> closes connection
     */
    private withConnection;
    /**
     * Test the database connection
     */
    testConnection(): Promise<void>;
    /**
     * Get schema metadata (uses cache if available)
     */
    getSchemaMetadata(): Promise<SchemaMetadata>;
    /**
     * Execute a SQL query
     */
    executeQuery(sql: string, params?: unknown[]): Promise<unknown[]>;
    /**
     * Execute a safe (read-only) SQL query
     */
    executeSafeQuery(sql: string, params?: unknown[]): Promise<unknown[]>;
}
/**
 * Create an adapter for a session (if config exists)
 */
export declare function createAdapterForSession(sessionId: string): PostgreSQLAdapter | null;
/**
 * Test and store a database configuration for a session
 */
export declare function configureSession(sessionId: string, config: DbConfig): Promise<void>;
//# sourceMappingURL=postgres.d.ts.map