import type { MessageListener, PatternMessageListener } from '@vp/core/ports';
import { CacheClient } from '@vp/core/ports';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { type Result, err, ok } from '@vp/result';

export interface PublishedMessage {
  channel: string;
  message: string;
  publishedAt: Date;
}

export class InMemoryCacheClient extends CacheClient {
  private readonly listeners = new Map<string, Set<MessageListener>>();
  private readonly patternListeners = new Map<string, Set<PatternMessageListener>>();
  private readonly kv = new Map<string, { value: string; expiresAt?: number }>();
  readonly publishedMessages: PublishedMessage[] = [];
  private isHealthy = true;

  setHealthy(healthy: boolean): void {
    this.isHealthy = healthy;
  }

  async checkHealth(): Promise<Result<void, CacheUnavailable>> {
    return this.isHealthy ? ok() : err(cacheUnavailable('checkHealth'));
  }

  async ping(): Promise<Result<string, CacheUnavailable>> {
    return this.isHealthy ? ok('PONG') : err(cacheUnavailable('ping'));
  }

  async publish(channel: string, message: string): Promise<Result<number, CacheUnavailable>> {
    this.publishedMessages.push({
      channel,
      message,
      publishedAt: new Date(),
    });

    let count = 0;

    // Direct channel listeners
    const channelListeners = this.listeners.get(channel);
    if (channelListeners && channelListeners.size > 0) {
      for (const listener of channelListeners) {
        try {
          listener(channel, message);
          count++;
        } catch {
          // Safe listener execution
        }
      }
    }

    // Pattern listeners (e.g. 'video:*' -> matches 'video:123')
    for (const [pattern, set] of this.patternListeners.entries()) {
      if (this.matchesPattern(pattern, channel)) {
        for (const listener of set) {
          try {
            listener(pattern, channel, message);
            count++;
          } catch {
            // Safe listener execution
          }
        }
      }
    }

    return ok(count);
  }

  async subscribe(
    channel: string,
    listener: MessageListener
  ): Promise<Result<void, CacheUnavailable>> {
    let set = this.listeners.get(channel);
    if (!set) {
      set = new Set();
      this.listeners.set(channel, set);
    }
    set.add(listener);
    return ok();
  }

  async unsubscribe(
    channel: string,
    listener?: MessageListener
  ): Promise<Result<void, CacheUnavailable>> {
    if (!listener) {
      this.listeners.delete(channel);
      return ok();
    }
    const set = this.listeners.get(channel);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(channel);
      }
    }
    return ok();
  }

  async psubscribe(
    pattern: string,
    listener: PatternMessageListener
  ): Promise<Result<void, CacheUnavailable>> {
    let set = this.patternListeners.get(pattern);
    if (!set) {
      set = new Set();
      this.patternListeners.set(pattern, set);
    }
    set.add(listener);
    return ok();
  }

  async punsubscribe(
    pattern: string,
    listener?: PatternMessageListener
  ): Promise<Result<void, CacheUnavailable>> {
    if (!listener) {
      this.patternListeners.delete(pattern);
      return ok();
    }
    const set = this.patternListeners.get(pattern);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.patternListeners.delete(pattern);
      }
    }
    return ok();
  }

  async get(key: string): Promise<Result<string | null, CacheUnavailable>> {
    const item = this.kv.get(key);
    if (!item) return ok(null);
    if (item.expiresAt !== undefined && Date.now() > item.expiresAt) {
      this.kv.delete(key);
      return ok(null);
    }
    return ok(item.value);
  }

  async set(
    key: string,
    value: string,
    ttlSeconds?: number
  ): Promise<Result<void, CacheUnavailable>> {
    const expiresAt = ttlSeconds !== undefined ? Date.now() + ttlSeconds * 1000 : undefined;
    this.kv.set(key, { value, expiresAt });
    return ok();
  }

  async del(...keys: string[]): Promise<Result<void, CacheUnavailable>> {
    for (const key of keys) this.kv.delete(key);
    return ok();
  }

  clear(): void {
    this.publishedMessages.length = 0;
    this.kv.clear();
  }

  clearListeners(): void {
    this.listeners.clear();
    this.patternListeners.clear();
  }

  async close(): Promise<Result<void, CacheUnavailable>> {
    this.clear();
    this.clearListeners();
    return ok();
  }

  private matchesPattern(pattern: string, channel: string): boolean {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`);
    return regex.test(channel);
  }
}
