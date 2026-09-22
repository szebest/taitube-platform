import { CacheError } from '@vp/core/ports';
import { RedisCacheClient } from '../redis-cache-client';
import { FakeRedis } from './fake-redis';

describe('RedisCacheClient', () => {
  let redis: FakeRedis;
  let cache: RedisCacheClient;

  beforeEach(() => {
    redis = new FakeRedis();
    cache = new RedisCacheClient({ client: redis.asRedis() });
  });

  describe('key/value', () => {
    it('round-trips a value', async () => {
      await cache.set('k', 'v');
      expect(await cache.get('k')).toBe('v');

      await cache.del('k');
      expect(await cache.get('k')).toBeNull();
    });

    it('passes the ttl through as an EX expiry', async () => {
      await cache.set('k', 'v', 30);
      expect(redis.ttls.get('k')).toBe(30);

      await cache.set('no-ttl', 'v');
      expect(redis.ttls.has('no-ttl')).toBe(false);
    });

    it.each([
      { op: 'get', run: (c: RedisCacheClient) => c.get('k'), driver: 'get' as const },
      { op: 'set', run: (c: RedisCacheClient) => c.set('k', 'v'), driver: 'set' as const },
      { op: 'del', run: (c: RedisCacheClient) => c.del('k'), driver: 'del' as const },
      { op: 'ping', run: (c: RedisCacheClient) => c.ping(), driver: 'ping' as const },
      {
        op: 'publish',
        run: (c: RedisCacheClient) => c.publish('ch', 'm'),
        driver: 'publish' as const,
      },
    ])('wraps a driver failure on $op in a CacheError', async ({ run, driver }) => {
      Object.assign(redis, {
        [driver]: async () => {
          throw new Error('connection lost');
        },
      });

      await expect(run(cache)).rejects.toThrow(CacheError);
    });
  });

  describe('health', () => {
    it('is healthy while the driver answers PONG', async () => {
      expect(await cache.checkHealth()).toBe(true);
      expect(await cache.ping()).toBe('PONG');
    });

    it.each([
      { scenario: 'the driver throws', ping: async () => Promise.reject(new Error('down')) },
      { scenario: 'the driver answers something else', ping: async () => 'NOPE' },
    ])('is unhealthy when $scenario', async ({ ping }) => {
      Object.assign(redis, { ping });
      expect(await cache.checkHealth()).toBe(false);
    });
  });

  describe('pub/sub', () => {
    it('subscribes on a dedicated connection and fans a message out to every listener', async () => {
      const seen: string[] = [];
      await cache.subscribe('events', (_channel, message) => seen.push(`a:${message}`));
      await cache.subscribe('events', (_channel, message) => seen.push(`b:${message}`));

      const subscriber = redis.lastDuplicate();
      expect(subscriber).toBeDefined();
      expect(redis.subscribedChannels.size).toBe(0);
      expect(subscriber?.subscribedChannels.has('events')).toBe(true);

      subscriber?.emit('message', 'events', 'hello');
      expect(seen).toEqual(['a:hello', 'b:hello']);
    });

    it('subscribes the driver only once per channel', async () => {
      const subscribeCalls: string[] = [];
      await cache.subscribe('events', () => {});
      const subscriber = redis.lastDuplicate() as FakeRedis;
      const original = subscriber.subscribe.bind(subscriber);
      Object.assign(subscriber, {
        subscribe: async (channel: string) => {
          subscribeCalls.push(channel);
          return original(channel);
        },
      });

      await cache.subscribe('events', () => {});
      expect(subscribeCalls).toEqual([]);
    });

    it('keeps the channel subscribed while another listener remains', async () => {
      const first = () => {};
      await cache.subscribe('events', first);
      await cache.subscribe('events', () => {});
      const subscriber = redis.lastDuplicate() as FakeRedis;

      await cache.unsubscribe('events', first);
      expect(subscriber.subscribedChannels.has('events')).toBe(true);
    });

    it('unsubscribes the driver once the last listener goes', async () => {
      const listener = () => {};
      await cache.subscribe('events', listener);
      const subscriber = redis.lastDuplicate() as FakeRedis;

      await cache.unsubscribe('events', listener);
      expect(subscriber.subscribedChannels.has('events')).toBe(false);
    });

    it('drops every listener when none is named', async () => {
      const seen: string[] = [];
      await cache.subscribe('events', (_c, m) => seen.push(m));
      const subscriber = redis.lastDuplicate() as FakeRedis;

      await cache.unsubscribe('events');
      subscriber.emit('message', 'events', 'ignored');

      expect(seen).toEqual([]);
      expect(subscriber.subscribedChannels.has('events')).toBe(false);
    });

    it('routes a pattern message to its pattern listeners', async () => {
      const seen: string[] = [];
      await cache.psubscribe('video:*', (_p, channel, message) =>
        seen.push(`${channel}:${message}`)
      );
      const subscriber = redis.lastDuplicate() as FakeRedis;

      expect(subscriber.subscribedPatterns.has('video:*')).toBe(true);
      subscriber.emit('pmessage', 'video:*', 'video:1', 'ready');
      expect(seen).toEqual(['video:1:ready']);
    });

    it('punsubscribes once the last pattern listener goes', async () => {
      const listener = () => {};
      await cache.psubscribe('video:*', listener);
      const subscriber = redis.lastDuplicate() as FakeRedis;

      await cache.punsubscribe('video:*', listener);
      expect(subscriber.subscribedPatterns.has('video:*')).toBe(false);

      await cache.psubscribe('video:*', () => {});
      await cache.punsubscribe('video:*');
      expect(subscriber.subscribedPatterns.has('video:*')).toBe(false);
    });

    it('survives a listener that throws', async () => {
      const seen: string[] = [];
      await cache.subscribe('events', () => {
        throw new Error('listener blew up');
      });
      await cache.subscribe('events', (_c, m) => seen.push(m));
      const subscriber = redis.lastDuplicate() as FakeRedis;

      subscriber.emit('message', 'events', 'still delivered');
      expect(seen).toEqual(['still delivered']);
    });

    it('publishes on the command connection, not the subscriber one', async () => {
      await cache.subscribe('events', () => {});
      await cache.publish('events', 'payload');

      expect(redis.published).toEqual([{ channel: 'events', message: 'payload' }]);
      expect(redis.lastDuplicate()?.published).toEqual([]);
    });
  });

  describe('close', () => {
    it('quits both connections', async () => {
      await cache.subscribe('events', () => {});
      const subscriber = redis.lastDuplicate() as FakeRedis;

      await cache.close();
      expect(redis.quitCalls).toBe(1);
      expect(subscriber.quitCalls).toBe(1);
    });

    it('falls back to a hard disconnect when quit is refused', async () => {
      redis.failNextQuit = true;

      await cache.close();
      expect(redis.disconnectCalls).toBe(1);
    });
  });
});
