import type { HealthCheckable } from './health-checkable.js';

export class CacheError extends Error {
  readonly code?: string;
  override readonly cause?: unknown;

  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message);
    this.name = 'CacheError';
    this.code = options?.code;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export abstract class CacheClient implements HealthCheckable {
  abstract checkHealth(): Promise<boolean>;
  abstract ping(): Promise<string>;
  abstract publish(channel: string, message: string): Promise<number>;
  abstract close(): Promise<void>;
}
