import { type CacheUnavailable, ErrorCodes } from '@vp/errors';
import type { Result } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import type { Redis } from 'ioredis';
import { redisViewBufferSubject } from '../../__tests__/contract/redis-subjects';
import { describeViewBufferContract } from '../../__tests__/contract/view-buffer.contract';
import { RedisViewBufferAdapter } from '../redis-view-buffer.adapter';
import { FakeRedis } from './fake-redis';

const VIDEO = '00000000-0000-7000-8000-00000000000a';
const DEDUP_KEY = `taitube:views:dedup:${VIDEO}:20260310`;
const VIEW = { videoId: VIDEO, viewerId: 'session-1', viewDate: '2026-03-10' };
const PLAYBACK = {
  videoId: VIDEO,
  sessionId: 'session-1',
  viewDate: '2026-03-10',
  watchedSeconds: 12,
  requiredSeconds: 5,
};

describe('RedisViewBufferAdapter', () => {
  let redis: FakeRedis;
  let buffer: RedisViewBufferAdapter;

  beforeEach(() => {
    redis = new FakeRedis();
    buffer = new RedisViewBufferAdapter({ redis: redis.asRedis(), dedupTtlSeconds: 86_400 });
  });

  it('slides the dedup window on every beacon, duplicates included', async () => {
    expectOk(await buffer.record(VIEW));
    redis.ttls.set(DEDUP_KEY, 1);

    expectOk(await buffer.record(VIEW));

    expect(redis.ttls.get(DEDUP_KEY)).toBe(86_400);
  });

  it('buffers views and watch time as separate fields of one hash', async () => {
    expectOk(await buffer.recordPlayback(PLAYBACK));

    expect(Object.fromEntries(redis.hashes.get('taitube:views:buffer') ?? [])).toEqual({
      [`${VIDEO}|2026-03-10|views`]: '1',
      [`${VIDEO}|2026-03-10|watch`]: '12',
    });
  });

  it('slides the session window on every retention beacon', async () => {
    const session = `taitube:retention:session:${VIDEO}:session-1`;
    expectOk(await buffer.recordRetention({ videoId: VIDEO, sessionId: 'session-1', percent: 5 }));
    redis.ttls.set(session, 1);

    expectOk(await buffer.recordRetention({ videoId: VIDEO, sessionId: 'session-1', percent: 5 }));

    expect(redis.ttls.get(session)).toBe(86_400);
  });

  it('moves both buffers under the batch and points at it, and release drops them together', async () => {
    expectOk(await buffer.record(VIEW));
    expectOk(await buffer.recordRetention({ videoId: VIDEO, sessionId: 's', percent: 5 }));

    expectOk(await buffer.snapshot('batch-1'));

    expect(redis.hashes.has('taitube:views:buffer')).toBe(false);
    expect(redis.hashes.has('taitube:retention:buffer')).toBe(false);
    expect(redis.hashes.has('taitube:views:flush:batch-1')).toBe(true);
    expect(redis.hashes.has('taitube:retention:flush:batch-1')).toBe(true);
    expect(redis.strings.get('taitube:views:flushing')).toBe('batch-1');

    expectOk(await buffer.release('batch-1'));

    expect([...redis.hashes.keys()].filter((key) => key.includes('flush'))).toEqual([]);
    expect(redis.strings.has('taitube:views:flushing')).toBe(false);
  });

  it('reports a pipeline in which one script failed as CACHE_UNAVAILABLE', async () => {
    const failing = {
      pipeline: () => ({
        eval: function (this: unknown) {
          return this;
        },
        exec: async () => [
          [null, 1],
          [new Error('BUSY'), null],
        ],
      }),
    } as unknown as Redis;
    const adapter = new RedisViewBufferAdapter({ redis: failing, dedupTtlSeconds: 1 });

    expect(expectErr(await adapter.recordAll([VIEW, VIEW])).code).toBe(
      ErrorCodes.CACHE_UNAVAILABLE
    );
  });

  it.each<[string, (b: RedisViewBufferAdapter) => Promise<Result<unknown, CacheUnavailable>>]>([
    ['record', (b) => b.record(VIEW)],
    ['snapshot', (b) => b.snapshot('batch-1')],
    ['release', (b) => b.release('batch-1')],
    ['recordAll', (b) => b.recordAll([VIEW])],
    ['recordRetention', (b) => b.recordRetention({ videoId: VIDEO, sessionId: 's', percent: 5 })],
    ['recordPlayback', (b) => b.recordPlayback(PLAYBACK)],
  ])('reports an unreachable Redis on %s as CACHE_UNAVAILABLE', async (_name, call) => {
    const down = {
      eval: () => Promise.reject(new Error('ECONNREFUSED')),
      pipeline: () => {
        throw new Error('ECONNREFUSED');
      },
    } as unknown as Redis;
    const failing = new RedisViewBufferAdapter({ redis: down, dedupTtlSeconds: 1 });

    expect(expectErr(await call(failing)).code).toBe(ErrorCodes.CACHE_UNAVAILABLE);
  });
});

describeViewBufferContract(redisViewBufferSubject);
