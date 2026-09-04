import { CacheClient, CacheError } from '@vp/core/ports';
import { Redis, type RedisOptions } from 'ioredis';

export interface RedisCacheClientConfig {
  url?: string;
  options?: RedisOptions;
  client?: Redis;
}

export class RedisCacheClient extends CacheClient {
  private readonly redis: Redis;

  constructor(config: RedisCacheClientConfig = {}) {
    super();
    if (config.client) {
      this.redis = config.client;
      return;
    }

    const url = config.url ?? process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379';
    this.redis = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      ...config.options,
    });
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

  async close(): Promise<void> {
    try {
      await this.redis.quit().catch(() => this.redis.disconnect());
    } catch (err: unknown) {
      throw new CacheError(`Failed to close Redis connection: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }
}
