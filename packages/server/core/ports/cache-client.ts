import type { CacheUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { HealthCheckable } from './health-checkable';

export type MessageListener = (channel: string, message: string) => void;
export type PatternMessageListener = (pattern: string, channel: string, message: string) => void;

export abstract class CacheClient implements HealthCheckable<CacheUnavailable> {
  abstract checkHealth(): Promise<Result<void, CacheUnavailable>>;
  abstract ping(): Promise<Result<string, CacheUnavailable>>;
  abstract publish(channel: string, message: string): Promise<Result<number, CacheUnavailable>>;
  abstract subscribe(
    channel: string,
    listener: MessageListener
  ): Promise<Result<void, CacheUnavailable>>;
  abstract unsubscribe(
    channel: string,
    listener?: MessageListener
  ): Promise<Result<void, CacheUnavailable>>;
  abstract psubscribe(
    pattern: string,
    listener: PatternMessageListener
  ): Promise<Result<void, CacheUnavailable>>;
  abstract punsubscribe(
    pattern: string,
    listener?: PatternMessageListener
  ): Promise<Result<void, CacheUnavailable>>;
  /** A miss is `ok(null)`: absence is not a failure, a dead cache is. */
  abstract get(key: string): Promise<Result<string | null, CacheUnavailable>>;
  abstract set(
    key: string,
    value: string,
    ttlSeconds?: number
  ): Promise<Result<void, CacheUnavailable>>;
  /** Deleting nothing, or keys that are not there, is a success. */
  abstract del(...keys: string[]): Promise<Result<void, CacheUnavailable>>;
  abstract close(): Promise<Result<void, CacheUnavailable>>;
}
