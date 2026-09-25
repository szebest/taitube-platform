import { randomUUID } from 'node:crypto';
import type { CacheClient } from '@vp/core/ports';
import { expectOk } from '@vp/testing/result';

export interface CacheClientSubject {
  readonly cache: CacheClient;
  close(): Promise<void>;
}

export type MakeCacheClientSubject = () => Promise<CacheClientSubject>;

export function describeCacheClientContract(makeSubject: MakeCacheClientSubject): void {
  describe('CacheClient contract', () => {
    let subject: CacheClientSubject;
    let cache: CacheClient;
    let scope: string;

    beforeAll(async () => {
      subject = await makeSubject();
      cache = subject.cache;
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(() => {
      scope = `contract:${randomUUID()}`;
    });

    it('answers a health check and a ping', async () => {
      expectOk(await cache.checkHealth());
      expect(expectOk(await cache.ping())).toBe('PONG');
    });

    it('answers ok(null) for a key that was never set', async () => {
      expect(expectOk(await cache.get(`${scope}:absent`))).toBeNull();
    });

    it('round-trips a value, overwrites it, and forgets it once deleted', async () => {
      const key = `${scope}:k`;
      expectOk(await cache.set(key, 'first'));
      expectOk(await cache.set(key, 'second', 60));
      expect(expectOk(await cache.get(key))).toBe('second');

      expectOk(await cache.del(key));

      expect(expectOk(await cache.get(key))).toBeNull();
    });

    it('treats deleting a key that is not there, or no key at all, as a success', async () => {
      expectOk(await cache.del(`${scope}:absent`));
      expectOk(await cache.del());
    });

    it('deletes several keys in one call', async () => {
      expectOk(await cache.set(`${scope}:a`, '1'));
      expectOk(await cache.set(`${scope}:b`, '2'));

      expectOk(await cache.del(`${scope}:a`, `${scope}:b`));

      expect(expectOk(await cache.get(`${scope}:a`))).toBeNull();
      expect(expectOk(await cache.get(`${scope}:b`))).toBeNull();
    });

    it('delivers a message to a channel subscriber and counts it as one receiver', async () => {
      const channel = `${scope}:channel`;
      const received = Promise.withResolvers<string>();
      expectOk(await cache.subscribe(channel, (_channel, message) => received.resolve(message)));

      expect(expectOk(await cache.publish(channel, 'hello'))).toBe(1);
      expect(await received.promise).toBe('hello');

      expectOk(await cache.unsubscribe(channel));
    });

    it('delivers a message to a pattern subscriber with the pattern and the channel', async () => {
      const pattern = `${scope}:video:*`;
      const received = Promise.withResolvers<string[]>();
      expectOk(
        await cache.psubscribe(pattern, (matched, channel, message) =>
          received.resolve([matched, channel, message])
        )
      );

      expectOk(await cache.publish(`${scope}:video:1`, 'ready'));

      expect(await received.promise).toEqual([pattern, `${scope}:video:1`, 'ready']);
      expectOk(await cache.punsubscribe(pattern));
    });

    it('stops delivering to a channel once it is unsubscribed', async () => {
      const channel = `${scope}:channel`;
      expectOk(await cache.subscribe(channel, () => {}));

      expectOk(await cache.unsubscribe(channel));

      expect(expectOk(await cache.publish(channel, 'nobody'))).toBe(0);
    });
  });
}
