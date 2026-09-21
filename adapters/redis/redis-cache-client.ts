import type { MessageListener, PatternMessageListener } from '@vp/core/ports';
import { CacheClient, CacheError } from '@vp/core/ports';
import { Redis, type RedisOptions } from 'ioredis';

export interface RedisCacheClientConfig {
  url?: string;
  options?: RedisOptions;
  client?: Redis;
}

export class RedisCacheClient extends CacheClient {
  private readonly redis: Redis;
  private subRedis?: Redis;
  private readonly url: string;
  private readonly options?: RedisOptions;
  private readonly channelListeners = new Map<string, Set<MessageListener>>();
  private readonly patternListeners = new Map<string, Set<PatternMessageListener>>();

  constructor(config: RedisCacheClientConfig = {}) {
    super();
    this.url = config.url ?? process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379';
    this.options = config.options;

    if (config.client) {
      this.redis = config.client;
      return;
    }

    this.redis = new Redis(this.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      ...config.options,
    });
  }

  getRedis(): Redis {
    return this.redis;
  }

  private getSubRedis(): Redis {
    if (!this.subRedis) {
      this.subRedis = new Redis(this.url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        ...this.options,
      });

      this.subRedis.on('message', (channel: string, message: string) => {
        const listeners = this.channelListeners.get(channel);
        if (listeners) {
          for (const listener of listeners) {
            try {
              listener(channel, message);
            } catch {
              // Safe listener execution
            }
          }
        }
      });

      this.subRedis.on('pmessage', (pattern: string, channel: string, message: string) => {
        const listeners = this.patternListeners.get(pattern);
        if (listeners) {
          for (const listener of listeners) {
            try {
              listener(pattern, channel, message);
            } catch {
              // Safe listener execution
            }
          }
        }
      });
    }
    return this.subRedis;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await this.redis.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  async ping(): Promise<string> {
    try {
      return await this.redis.ping();
    } catch (err: unknown) {
      throw new CacheError(`Redis ping failed: ${(err as Error).message}`, { cause: err });
    }
  }

  async publish(channel: string, message: string): Promise<number> {
    try {
      return await this.redis.publish(channel, message);
    } catch (err: unknown) {
      throw new CacheError(`Failed to publish to channel "${channel}": ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async subscribe(channel: string, listener: MessageListener): Promise<void> {
    try {
      let set = this.channelListeners.get(channel);
      const isNew = !set || set.size === 0;
      if (!set) {
        set = new Set();
        this.channelListeners.set(channel, set);
      }
      set.add(listener);
      if (isNew) {
        await this.getSubRedis().subscribe(channel);
      }
    } catch (err: unknown) {
      throw new CacheError(
        `Failed to subscribe to channel "${channel}": ${(err as Error).message}`,
        {
          cause: err,
        }
      );
    }
  }

  async unsubscribe(channel: string, listener?: MessageListener): Promise<void> {
    try {
      if (!listener) {
        this.channelListeners.delete(channel);
        if (this.subRedis) {
          await this.subRedis.unsubscribe(channel);
        }
        return;
      }
      const set = this.channelListeners.get(channel);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.channelListeners.delete(channel);
          if (this.subRedis) {
            await this.subRedis.unsubscribe(channel);
          }
        }
      }
    } catch (err: unknown) {
      throw new CacheError(
        `Failed to unsubscribe from channel "${channel}": ${(err as Error).message}`,
        {
          cause: err,
        }
      );
    }
  }

  async psubscribe(pattern: string, listener: PatternMessageListener): Promise<void> {
    try {
      let set = this.patternListeners.get(pattern);
      const isNew = !set || set.size === 0;
      if (!set) {
        set = new Set();
        this.patternListeners.set(pattern, set);
      }
      set.add(listener);
      if (isNew) {
        await this.getSubRedis().psubscribe(pattern);
      }
    } catch (err: unknown) {
      throw new CacheError(
        `Failed to psubscribe to pattern "${pattern}": ${(err as Error).message}`,
        {
          cause: err,
        }
      );
    }
  }

  async punsubscribe(pattern: string, listener?: PatternMessageListener): Promise<void> {
    try {
      if (!listener) {
        this.patternListeners.delete(pattern);
        if (this.subRedis) {
          await this.subRedis.punsubscribe(pattern);
        }
        return;
      }
      const set = this.patternListeners.get(pattern);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.patternListeners.delete(pattern);
          if (this.subRedis) {
            await this.subRedis.punsubscribe(pattern);
          }
        }
      }
    } catch (err: unknown) {
      throw new CacheError(
        `Failed to punsubscribe from pattern "${pattern}": ${(err as Error).message}`,
        {
          cause: err,
        }
      );
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (err: unknown) {
      throw new CacheError(`Failed to get key "${key}": ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds !== undefined) {
        await this.redis.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.redis.set(key, value);
      }
    } catch (err: unknown) {
      throw new CacheError(`Failed to set key "${key}": ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err: unknown) {
      throw new CacheError(`Failed to delete key "${key}": ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async close(): Promise<void> {
    try {
      const closes: Promise<unknown>[] = [this.redis.quit().catch(() => this.redis.disconnect())];
      if (this.subRedis) {
        closes.push(this.subRedis.quit().catch(() => this.subRedis?.disconnect()));
      }
      await Promise.all(closes);
    } catch (err: unknown) {
      throw new CacheError(`Failed to close Redis connection: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }
}
