import { DatabaseClient } from '@vp/core/ports';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, err, ok } from '@vp/result';

export class InMemoryDatabaseClient extends DatabaseClient {
  private healthy = true;

  setHealthy(healthy: boolean): void {
    this.healthy = healthy;
  }

  async checkHealth(): Promise<Result<void, DatabaseUnavailable>> {
    return this.healthy ? ok() : err(databaseUnavailable('checkHealth'));
  }

  async query<T = unknown>(
    _sql: string,
    _params: unknown[] = []
  ): Promise<Result<T[], DatabaseUnavailable>> {
    return ok([]);
  }

  async execute(
    _sql: string,
    _params: unknown[] = []
  ): Promise<Result<number, DatabaseUnavailable>> {
    return ok(0);
  }

  async transaction<T, E>(
    fn: (tx: DatabaseClient) => Promise<Result<T, E>>
  ): Promise<Result<T, E | DatabaseUnavailable>> {
    return fn(this);
  }

  async close(): Promise<Result<void, DatabaseUnavailable>> {
    return ok();
  }
}
