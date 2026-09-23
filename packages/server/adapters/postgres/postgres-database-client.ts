import { DatabaseClient } from '@vp/core/ports';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, fromPromise, map } from '@vp/result';
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

  private unavailable(operation: string) {
    return (cause: unknown): DatabaseUnavailable => databaseUnavailable(operation, cause);
  }

  async checkHealth(): Promise<Result<void, DatabaseUnavailable>> {
    const probed = await fromPromise(() => this.sql`SELECT 1`, this.unavailable('checkHealth'));
    return map(probed, () => undefined);
  }

  async query<T = unknown>(
    queryText: string,
    params: unknown[] = []
  ): Promise<Result<T[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.sql.unsafe(queryText, params as never[]),
      this.unavailable('query')
    );

    return map(rows, (found) => found as unknown as T[]);
  }

  async execute(
    queryText: string,
    params: unknown[] = []
  ): Promise<Result<number, DatabaseUnavailable>> {
    const executed = await fromPromise(
      () => this.sql.unsafe(queryText, params as never[]),
      this.unavailable('execute')
    );

    return map(executed, (res) => res.count ?? 0);
  }

  async transaction<T, E>(
    fn: (tx: DatabaseClient) => Promise<Result<T, E>>
  ): Promise<Result<T, E | DatabaseUnavailable>> {
    const committed = await fromPromise(
      () =>
        this.sql.begin((txSql) => fn(new PostgresDatabaseClient({ sql: txSql as unknown as Sql }))),
      this.unavailable('transaction')
    );

    return committed.ok ? committed.value : committed;
  }

  async close(): Promise<Result<void, DatabaseUnavailable>> {
    const closed = await fromPromise(() => this.sql.end(), this.unavailable('close'));
    return map(closed, () => undefined);
  }
}
