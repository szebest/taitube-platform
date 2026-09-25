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
const VIEW = { videoId: VIDEO, viewerId: 'session-1', viewDate: '2026-03-10', watchSeconds: 12 };

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
    expectOk(await buffer.record(VIEW));

    expect(Object.fromEntries(redis.hashes.get('taitube:views:buffer') ?? [])).toEqual({
      [`${VIDEO}|2026-03-10|views`]: '1',
      [`${VIDEO}|2026-03-10|watch`]: '12',
    });
  });

  it('moves the buffer under the batch key and points at the batch', async () => {
    expectOk(await buffer.record(VIEW));

    expectOk(await buffer.snapshot('batch-1'));

    expect(redis.hashes.has('taitube:views:buffer')).toBe(false);
    expect(redis.hashes.has('taitube:views:flush:batch-1')).toBe(true);
    expect(redis.strings.get('taitube:views:flushing')).toBe('batch-1');
  });

  it.each<[string, (b: RedisViewBufferAdapter) => Promise<Result<unknown, CacheUnavailable>>]>([
    ['record', (b) => b.record(VIEW)],
    ['snapshot', (b) => b.snapshot('batch-1')],
    ['release', (b) => b.release('batch-1')],
    ['add', (b) => b.add([{ ...VIEW, views: 1 }])],
  ])('reports an unreachable Redis on %s as CACHE_UNAVAILABLE', async (_name, call) => {
    const down = {
      eval: () => Promise.reject(new Error('ECONNREFUSED')),
      multi: () => {
        throw new Error('ECONNREFUSED');
      },
    } as unknown as Redis;
    const failing = new RedisViewBufferAdapter({ redis: down, dedupTtlSeconds: 1 });

    expect(expectErr(await call(failing)).code).toBe(ErrorCodes.CACHE_UNAVAILABLE);
  });
});

describeViewBufferContract(redisViewBufferSubject);
