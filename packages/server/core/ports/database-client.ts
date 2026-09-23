import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { HealthCheckable } from './health-checkable';

export abstract class DatabaseClient implements HealthCheckable<DatabaseUnavailable> {
  abstract checkHealth(): Promise<Result<void, DatabaseUnavailable>>;
  abstract query<T = unknown>(
    sql: string,
    params?: unknown[]
  ): Promise<Result<T[], DatabaseUnavailable>>;
  abstract execute(sql: string, params?: unknown[]): Promise<Result<number, DatabaseUnavailable>>;
  abstract transaction<T, E>(
    fn: (tx: DatabaseClient) => Promise<Result<T, E>>
  ): Promise<Result<T, E | DatabaseUnavailable>>;
  abstract close(): Promise<Result<void, DatabaseUnavailable>>;
}
