import { DatabaseClient } from '@vp/core/ports';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, assertNever, fromPromise, map, ok } from '@vp/result';
import postgres, { type Sql, type TransactionSql } from 'postgres';

/** A `sql` pool is borrowed and stays open on close; a `url` opens a pool the client ends. */
export type PostgresDatabaseClientConfig =
  | { type: 'sql'; sql: Sql }
  | { type: 'url'; url: string; max: number };

function unavailable(operation: string) {
  return (cause: unknown): DatabaseUnavailable => databaseUnavailable(operation, cause);
}

/** The queries a pool and a transaction answer alike; only how each nests and closes differs. */
abstract class PostgresSession extends DatabaseClient {
  protected abstract readonly session: postgres.ISql;

  async checkHealth(): Promise<Result<void, DatabaseUnavailable>> {
    const probed = await fromPromise(() => this.session`SELECT 1`, unavailable('checkHealth'));
    return map(probed, () => undefined);
  }

  async query<T = unknown>(
    queryText: string,
    params: unknown[] = []
  ): Promise<Result<T[], DatabaseUnavailable>> {
    return fromPromise(
      () => this.session.unsafe<T[]>(queryText, params as never[]),
      unavailable('query')
    );
  }

  async execute(
    queryText: string,
    params: unknown[] = []
  ): Promise<Result<number, DatabaseUnavailable>> {
    const executed = await fromPromise(
      () => this.session.unsafe(queryText, params as never[]),
      unavailable('execute')
    );

    return map(executed, (res) => res.count ?? 0);
  }
}

class PostgresTransactionClient extends PostgresSession {
  constructor(protected readonly session: TransactionSql) {
    super();
  }

  async transaction<T, E>(
    fn: (tx: DatabaseClient) => Promise<Result<T, E>>
  ): Promise<Result<T, E | DatabaseUnavailable>> {
    const committed = await fromPromise(
      () => this.session.savepoint((sp) => fn(new PostgresTransactionClient(sp))),
      unavailable('transaction')
    );

    return committed.ok ? committed.value : committed;
  }

  async close(): Promise<Result<void, DatabaseUnavailable>> {
    return ok();
  }
}

export class PostgresDatabaseClient extends PostgresSession {
  protected readonly session: Sql;
  private readonly ownsPool: boolean;

  constructor(config: PostgresDatabaseClientConfig) {
    super();
    switch (config.type) {
      case 'sql':
        this.session = config.sql;
        this.ownsPool = false;
        return;
      case 'url':
        this.session = postgres(config.url, {
          max: config.max,
          idle_timeout: 20,
          connect_timeout: 10,
        });
        this.ownsPool = true;
        return;
      default:
        assertNever(config, 'PostgresDatabaseClientConfig');
    }
  }

  getRawSql(): Sql {
    return this.session;
  }

  async transaction<T, E>(
    fn: (tx: DatabaseClient) => Promise<Result<T, E>>
  ): Promise<Result<T, E | DatabaseUnavailable>> {
    const committed = await fromPromise(
      () => this.session.begin((tx) => fn(new PostgresTransactionClient(tx))),
      unavailable('transaction')
    );

    return committed.ok ? committed.value : committed;
  }

  async close(): Promise<Result<void, DatabaseUnavailable>> {
    if (!this.ownsPool) return ok();
    const closed = await fromPromise(() => this.session.end(), unavailable('close'));
    return map(closed, () => undefined);
  }
}
