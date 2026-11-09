import type { CacheClient } from '@vp/core/ports';
import type { CacheUnavailable } from '@vp/errors';
import type { Logger } from '@vp/logger';
import { ignore, isErr, parseJson, type Result } from '@vp/result';
import type { z } from 'zod';

type Listener<E> = (event: E) => void;

export interface PatternHubOptions<E> {
  readonly cache: Pick<CacheClient, 'psubscribe' | 'punsubscribe'>;
  readonly logger: Logger;
  /** The one pattern subscription this pod holds, `prefix:*`. */
  readonly pattern: string;
  /** The listeners' key a channel belongs to; `null` for a channel outside the pattern's family. */
  readonly keyOf: (channel: string) => string | null;
  /** A message the contract does not know is dropped and logged, never handed on. */
  readonly schema: z.ZodType<E>;
}

/**
 * One pattern subscription per pod, fanned out to the listeners joined under each channel's key,
 * so a socket on any pod hears a change published on any other.
 */
export class PatternHub<E> {
  private readonly listeners = new Map<string, Set<Listener<E>>>();
  private subscribing: Promise<Result<void, CacheUnavailable>> | undefined;
  private readonly onMessage = (_pattern: string, channel: string, raw: string) => {
    this.deliver(channel, raw);
  };

  constructor(private readonly options: PatternHubOptions<E>) {}

  /** Idempotent, and retried by the next caller after a failure. */
  async init(): Promise<Result<void, CacheUnavailable>> {
    const { cache, pattern } = this.options;
    this.subscribing ??= cache.psubscribe(pattern, this.onMessage);
    const subscribed = await this.subscribing;
    if (isErr(subscribed)) this.subscribing = undefined;
    return subscribed;
  }

  join(key: string, listener: Listener<E>): () => void {
    const listeners = new Set(this.listeners.get(key)).add(listener);
    this.listeners.set(key, listeners);
    return () => {
      const remaining = new Set(this.listeners.get(key));
      remaining.delete(listener);
      if (remaining.size === 0) this.listeners.delete(key);
      else this.listeners.set(key, remaining);
    };
  }

  async close(): Promise<void> {
    this.listeners.clear();
    if (!this.subscribing) return;
    this.subscribing = undefined;
    ignore(
      await this.options.cache.punsubscribe(this.options.pattern, this.onMessage),
      'a cache that is already gone has nothing to unsubscribe from'
    );
  }

  private deliver(channel: string, raw: string): void {
    const key = this.options.keyOf(channel);
    const listeners = key === null ? undefined : this.listeners.get(key);
    if (!listeners) return;

    const decoded = parseJson(raw);
    const event = isErr(decoded) ? null : this.options.schema.safeParse(decoded.value);
    if (!event?.success) {
      this.options.logger.warn({ channel }, 'dropped a broadcast the contract does not know');
      return;
    }
    for (const listener of listeners) listener(event.data);
  }
}
