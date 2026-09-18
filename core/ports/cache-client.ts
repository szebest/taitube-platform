import type { HealthCheckable } from './health-checkable';

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

export type MessageListener = (channel: string, message: string) => void;
export type PatternMessageListener = (pattern: string, channel: string, message: string) => void;

export abstract class CacheClient implements HealthCheckable {
  abstract checkHealth(): Promise<boolean>;
  abstract ping(): Promise<string>;
  abstract publish(channel: string, message: string): Promise<number>;
  abstract subscribe(channel: string, listener: MessageListener): Promise<void> | void;
  abstract unsubscribe(channel: string, listener?: MessageListener): Promise<void> | void;
  abstract psubscribe(pattern: string, listener: PatternMessageListener): Promise<void> | void;
  abstract punsubscribe(pattern: string, listener?: PatternMessageListener): Promise<void> | void;
  abstract get(key: string): Promise<string | null>;
  abstract set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  abstract del(key: string): Promise<void>;
  abstract close(): Promise<void>;
}
