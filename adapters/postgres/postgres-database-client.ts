import { DatabaseClient, DatabaseError } from '@vp/core/ports';
import postgres, { type Sql } from 'postgres';

export interface PostgresDatabaseClientConfig {
  connectionString?: string;
  sql?: Sql;
}

export class PostgresDatabaseClient extends DatabaseClient {
  private readonly sql: Sql;

  constructor(config: PostgresDatabaseClientConfig = {}) {
    super();
    if (config.sql) {
      this.sql = config.sql;
      return;
    }

    const connectionString =
      config.connectionString ??
      process.env['DATABASE_URL'] ??
      'postgres://vp:vppass@localhost:5432/videopipeline';

    this.sql = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  getRawSql(): Sql {
    return this.sql;
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.sql`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async query<T = unknown>(queryText: string, params: unknown[] = []): Promise<T[]> {
    try {
      return (await this.sql.unsafe(queryText, params as any[])) as unknown as T[];
    } catch (err: unknown) {
      throw new DatabaseError(`Database query failed: ${(err as Error).message}`, { cause: err });
    }
  }

  async execute(queryText: string, params: unknown[] = []): Promise<number> {
    try {
      const res = await this.sql.unsafe(queryText, params as any[]);
      return res.count ?? 0;
    } catch (err: unknown) {
      throw new DatabaseError(`Database execute failed: ${(err as Error).message}`, { cause: err });
    }
  }

  async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
    try {
      const res = await (this.sql.begin as any)(async (txSql: unknown) => {
        const txClient = new PostgresDatabaseClient({ sql: txSql as Sql });
        return await fn(txClient);
      });
      return res as T;
    } catch (err: unknown) {
      throw new DatabaseError(`Transaction failed: ${(err as Error).message}`, { cause: err });
    }
  }

  async close(): Promise<void> {
    await this.sql.end();
  }
}
