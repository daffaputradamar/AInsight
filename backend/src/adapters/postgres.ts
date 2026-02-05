import { Pool, PoolClient } from 'pg';

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

class PostgreSQLAdapter {
  private pool: Pool;
  private schemaCache: SchemaMetadata | null = null;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'agent_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      client.release();
      console.log('PostgreSQL connection established');
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async getSchemaMetadata(): Promise<SchemaMetadata> {
    if (this.schemaCache && Date.now() - this.schemaCache.lastUpdated.getTime() < 300000) {
      return this.schemaCache;
    }

    const client = await this.pool.connect();
    try {
      const tablesQuery = `
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public'
      `;
      const tablesResult = await client.query(tablesQuery);
      const tableNames = tablesResult.rows.map((row) => row.tablename);

      const tables: TableSchema[] = [];

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

      this.schemaCache = {
        tables,
        lastUpdated: new Date(),
      };

      return this.schemaCache;
    } finally {
      client.release();
    }
  }

  async executeQuery(sql: string, params: unknown[] = []): Promise<unknown[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async executeSafeQuery(sql: string, params: unknown[] = []): Promise<unknown[]> {
    // Validate SQL to prevent dangerous operations
    const forbiddenPatterns = [/DROP\s+TABLE/i, /DELETE\s+FROM/i, /TRUNCATE/i, /ALTER\s+TABLE/i];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(sql)) {
        throw new Error('Dangerous SQL operation detected. Read-only queries only.');
      }
    }

    return this.executeQuery(sql, params);
  }

  getPool(): Pool {
    return this.pool;
  }
}

export const pgAdapter = new PostgreSQLAdapter();
