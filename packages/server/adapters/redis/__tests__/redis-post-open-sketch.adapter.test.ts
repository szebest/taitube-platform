import { expectOk } from '@kit/testing/result';
import { POST_OPEN_SKETCH_TTL_SECONDS } from '@vp/domain';
import { CacheKeys } from '@vp/events';
import type { Redis } from 'ioredis';
import { RedisPostOpenSketchAdapter } from '../redis-post-open-sketch.adapter';

function redisWith(replies: [Error | null, unknown][] | null) {
  const calls: string[][] = [];
  const chain = {
    pfadd: (...args: string[]) => {
      calls.push(['pfadd', ...args]);
      return chain;
    },
    expire: (...args: (string | number)[]) => {
      calls.push(['expire', ...args.map(String)]);
      return chain;
    },
    exec: async () => replies,
  };
  return { redis: { multi: () => chain } as unknown as Redis, calls };
}

describe('RedisPostOpenSketchAdapter', () => {
  it.each([
    { name: 'a viewer the sketch did not hold', reply: 1, counted: true },
    { name: 'a viewer the sketch already held', reply: 0, counted: false },
  ])(
    'answers $counted for $name, adding it and expiring the day key together',
    async ({ reply, counted }) => {
      const { redis, calls } = redisWith([
        [null, reply],
        [null, 1],
      ]);

      const result = await new RedisPostOpenSketchAdapter(redis).record('p1', 'u1', '2026-03-01');

      expect(expectOk(result)).toBe(counted);
      expect(calls).toEqual([
        ['pfadd', CacheKeys.postOpens('p1', '2026-03-01'), 'u1'],
        ['expire', CacheKeys.postOpens('p1', '2026-03-01'), String(POST_OPEN_SKETCH_TTL_SECONDS)],
      ]);
    }
  );

  it('reports the cache as unavailable when Redis fails', async () => {
    const redis = {
      multi: () => {
        throw new Error('connection dropped');
      },
    } as unknown as Redis;

    const result = await new RedisPostOpenSketchAdapter(redis).record('p1', 'u1', '2026-03-01');

    expect(result).toMatchObject({ ok: false });
  });
});
