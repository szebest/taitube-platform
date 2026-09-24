import type { MessageListener, PatternMessageListener } from '@vp/core/ports';
import { CacheClient } from '@vp/core/ports';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { type Result, assertNever, err, fromPromise, map, ok } from '@vp/result';
import { Redis, type RedisOptions } from 'ioredis';

export type RedisCacheClientConfig =
  | { type: 'client'; client: Redis }
  | {
      type: 'url';
      url: string;
      pubsubUrl: string;
      password: string | undefined;
      options?: RedisOptions;
    };

export class RedisCacheClient extends CacheClient {
  private readonly redis: Redis;
  private readonly pubsubRedis: Redis;
  private subRedis?: Redis;
  private readonly channelListeners = new Map<string, Set<MessageListener>>();
  private readonly patternListeners = new Map<string, Set<PatternMessageListener>>();

  constructor(config: RedisCacheClientConfig) {
    super();

    switch (config.type) {
      case 'client':
        this.redis = config.client;
        this.pubsubRedis = config.client;
        return;
      case 'url': {
        const options: RedisOptions = {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          lazyConnect: true,
          ...(config.password ? { password: config.password } : {}),
          ...config.options,
        };
        this.redis = new Redis(config.url, options);
        this.pubsubRedis =
          config.pubsubUrl === config.url ? this.redis : new Redis(config.pubsubUrl, options);
        return;
      }
      default:
        assertNever(config, 'RedisCacheClientConfig');
    }
  }

  getRedis(): Redis {
    return this.redis;
  }

  /** A connection in subscriber mode accepts no other command, so pub/sub gets its own. */
  private getSubRedis(): Redis {
    if (!this.subRedis) {
      this.subRedis = this.pubsubRedis.duplicate();

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

  async checkHealth(): Promise<Result<void, CacheUnavailable>> {
    const pinged = await fromPromise(
      () => this.redis.ping(),
      cacheUnavailable.during('checkHealth')
    );
    if (!pinged.ok) return pinged;
    return pinged.value === 'PONG' ? ok() : err(cacheUnavailable('checkHealth', pinged.value));
  }

  async ping(): Promise<Result<string, CacheUnavailable>> {
    return fromPromise(() => this.redis.ping(), cacheUnavailable.during('ping'));
  }

  async publish(channel: string, message: string): Promise<Result<number, CacheUnavailable>> {
    return fromPromise(
      () => this.pubsubRedis.publish(channel, message),
      cacheUnavailable.during('publish')
    );
  }

  async subscribe(
    channel: string,
    listener: MessageListener
  ): Promise<Result<void, CacheUnavailable>> {
    let set = this.channelListeners.get(channel);
    const isNew = !set || set.size === 0;
    if (!set) {
      set = new Set();
      this.channelListeners.set(channel, set);
    }
    set.add(listener);
    if (!isNew) return ok();

    const subscribed = await fromPromise(
      () => this.getSubRedis().subscribe(channel),
      cacheUnavailable.during('subscribe')
    );
    return map(subscribed, () => undefined);
  }

  async unsubscribe(
    channel: string,
    listener?: MessageListener
  ): Promise<Result<void, CacheUnavailable>> {
    const set = this.channelListeners.get(channel);
    if (listener && set) {
      set.delete(listener);
      if (set.size > 0) return ok();
    } else if (listener) {
      return ok();
    }

    this.channelListeners.delete(channel);
    const subRedis = this.subRedis;
    if (!subRedis) return ok();

    const unsubscribed = await fromPromise(
      () => subRedis.unsubscribe(channel),
      cacheUnavailable.during('unsubscribe')
    );
    return map(unsubscribed, () => undefined);
  }

  async psubscribe(
    pattern: string,
    listener: PatternMessageListener
  ): Promise<Result<void, CacheUnavailable>> {
    let set = this.patternListeners.get(pattern);
    const isNew = !set || set.size === 0;
    if (!set) {
      set = new Set();
      this.patternListeners.set(pattern, set);
    }
    set.add(listener);
    if (!isNew) return ok();

    const subscribed = await fromPromise(
      () => this.getSubRedis().psubscribe(pattern),
      cacheUnavailable.during('psubscribe')
    );
    return map(subscribed, () => undefined);
  }

  async punsubscribe(
    pattern: string,
    listener?: PatternMessageListener
  ): Promise<Result<void, CacheUnavailable>> {
    const set = this.patternListeners.get(pattern);
    if (listener && set) {
      set.delete(listener);
      if (set.size > 0) return ok();
    } else if (listener) {
      return ok();
    }

    this.patternListeners.delete(pattern);
    const subRedis = this.subRedis;
    if (!subRedis) return ok();

    const unsubscribed = await fromPromise(
      () => subRedis.punsubscribe(pattern),
      cacheUnavailable.during('punsubscribe')
    );
    return map(unsubscribed, () => undefined);
  }

  async get(key: string): Promise<Result<string | null, CacheUnavailable>> {
    return fromPromise(() => this.redis.get(key), cacheUnavailable.during('get'));
  }

  async set(
    key: string,
    value: string,
    ttlSeconds?: number
  ): Promise<Result<void, CacheUnavailable>> {
    const stored = await fromPromise(
      () =>
        ttlSeconds === undefined
          ? this.redis.set(key, value)
          : this.redis.set(key, value, 'EX', ttlSeconds),
      cacheUnavailable.during('set')
    );
    return map(stored, () => undefined);
  }

  async del(key: string): Promise<Result<void, CacheUnavailable>> {
    const deleted = await fromPromise(() => this.redis.del(key), cacheUnavailable.during('del'));
    return map(deleted, () => undefined);
  }

  async close(): Promise<Result<void, CacheUnavailable>> {
    const closed = await fromPromise(
      () =>
        Promise.all([
          this.redis.quit().catch(() => this.redis.disconnect()),
          this.pubsubRedis === this.redis
            ? undefined
            : this.pubsubRedis.quit().catch(() => this.pubsubRedis.disconnect()),
          this.subRedis?.quit().catch(() => this.subRedis?.disconnect()),
        ]),
      cacheUnavailable.during('close')
    );
    return map(closed, () => undefined);
  }
}
