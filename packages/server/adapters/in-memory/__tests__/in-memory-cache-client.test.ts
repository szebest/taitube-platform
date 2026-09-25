import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { describeCacheClientContract } from '../../__tests__/contract/cache-client.contract';
import { inMemoryCacheClientSubject } from '../../__tests__/contract/in-memory-port-subjects';
import { InMemoryCacheClient } from '../in-memory-cache-client';

describeCacheClientContract(inMemoryCacheClientSubject);

describe('InMemoryCacheClient', () => {
  it('records what was published, for a spec to read back, until clear', async () => {
    const cache = new InMemoryCacheClient();
    expectOk(await cache.publish('events', 'hello'));

    expect(cache.publishedMessages).toEqual([
      expect.objectContaining({ channel: 'events', message: 'hello' }),
    ]);
    cache.clear();
    expect(cache.publishedMessages).toEqual([]);
  });

  it('reports CACHE_UNAVAILABLE from its health check and ping once marked unhealthy', async () => {
    const cache = new InMemoryCacheClient();

    cache.setHealthy(false);

    expect(expectErr(await cache.checkHealth()).code).toBe(ErrorCodes.CACHE_UNAVAILABLE);
    expect(expectErr(await cache.ping()).code).toBe(ErrorCodes.CACHE_UNAVAILABLE);
  });

  it('keeps delivering to the other listeners when one throws', async () => {
    const cache = new InMemoryCacheClient();
    const seen: string[] = [];
    expectOk(
      await cache.subscribe('events', () => {
        throw new Error('listener broke');
      })
    );
    expectOk(await cache.subscribe('events', (_channel, message) => seen.push(message)));

    expect(expectOk(await cache.publish('events', 'hello'))).toBe(1);
    expect(seen).toEqual(['hello']);
  });
});
