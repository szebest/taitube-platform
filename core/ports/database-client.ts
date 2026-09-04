import type { HealthCheckable } from './health-checkable.js';

export class DatabaseError extends Error {
  readonly code?: string;
  override readonly cause?: unknown;

  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message);
    this.name = 'DatabaseError';
    this.code = options?.code;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export abstract class DatabaseClient implements HealthCheckable {
  abstract checkHealth(): Promise<boolean>;
  abstract query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  abstract execute(sql: string, params?: unknown[]): Promise<number>;
  abstract transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T>;
  abstract close(): Promise<void>;
}
