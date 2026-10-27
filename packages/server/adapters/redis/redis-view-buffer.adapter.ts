import type {
  RetentionMilestone,
  ViewBufferPort,
  ViewEvent,
  ViewRecordOutcome,
} from '@vp/core/ports';
import { RETENTION_STEP_PERCENT, type RetentionCount, type ViewBatch } from '@vp/domain';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { type Result, andThen, andThenAsync, err, fromPromise, map, ok } from '@vp/result';
import type { Redis } from 'ioredis';
import {
  countsFromBuffer,
  retentionFromBuffer,
  viewBufferField,
} from './view-buffer-fields';

/**
 * Each script runs atomically on the server. `record` must not count a viewer the dedup sketch
 * already holds, and `snapshot` must move the buffer and point at the batch in one step: split
 * either across round trips and a concurrent beacon or a crashed flush loses or doubles a view.
 */
export const VIEW_BUFFER_SCRIPTS = {
  record: `
local added = redis.call('PFADD', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
if added == 1 then
  redis.call('HINCRBY', KEYS[2], ARGV[3], 1)
  redis.call('HINCRBY', KEYS[2], ARGV[4], ARGV[5])
end
return added`,
  snapshot: `
local pending = redis.call('GET', KEYS[1])
if pending then return pending end
if redis.call('EXISTS', KEYS[2]) == 0 then return false end
redis.call('RENAME', KEYS[2], KEYS[3])
redis.call('SET', KEYS[1], ARGV[1])
return ARGV[1]`,
  recordRetention: `
local last = redis.call('GET', KEYS[1])
local target = tonumber(ARGV[1])
local step = tonumber(ARGV[2])
local first = 0
if last then
  first = tonumber(last) + step
end
for percent = first, target, step do
  redis.call('HINCRBY', KEYS[2], ARGV[4] .. '|' .. percent, 1)
end
if (not last) or tonumber(last) < target then
  redis.call('SET', KEYS[1], target)
end
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1`,
  drainRetention: `
local drained = redis.call('HGETALL', KEYS[1])
redis.call('DEL', KEYS[1])
return drained`,
  release: `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('DEL', KEYS[1], KEYS[2])
  return 1
end
return 0`,
} as const;

export interface RedisViewBufferAdapterConfig {
  redis: Redis;
  dedupTtlSeconds: number;
}

function outcomeOf(added: unknown): ViewRecordOutcome {
  return added === 1 ? 'counted' : 'duplicate';
}

export class RedisViewBufferAdapter implements ViewBufferPort {
  private readonly redis: Redis;
  private readonly dedupTtlSeconds: number;

  constructor(config: RedisViewBufferAdapterConfig) {
    this.redis = config.redis;
    this.dedupTtlSeconds = config.dedupTtlSeconds;
  }

  async record(view: ViewEvent): Promise<Result<ViewRecordOutcome, CacheUnavailable>> {
    const added = await fromPromise(
      () => this.redis.eval(...this.recordCall(view)),
      cacheUnavailable.during('recordView')
    );

    return map(added, outcomeOf);
  }

  async recordAll(
    views: readonly ViewEvent[]
  ): Promise<Result<ViewRecordOutcome[], CacheUnavailable>> {
    if (views.length === 0) return ok([]);

    const replies = await fromPromise(
      () =>
        views
          .reduce(
            (pipeline, view) => pipeline.eval(...this.recordCall(view)),
            this.redis.pipeline()
          )
          .exec(),
      cacheUnavailable.during('recordViews')
    );

    return andThen(replies, (settled): Result<ViewRecordOutcome[], CacheUnavailable> => {
      const failed = (settled ?? []).find(([error]) => error !== null);
      if (!settled || failed) return err(cacheUnavailable('recordViews', failed?.[0]));
      return ok(settled.map(([, added]) => outcomeOf(added)));
    });
  }

  async snapshot(batchId: string): Promise<Result<ViewBatch | null, CacheUnavailable>> {
    const pending = await fromPromise(
      () =>
        this.redis.eval(
          VIEW_BUFFER_SCRIPTS.snapshot,
          3,
          CacheKeys.viewFlushPointer,
          CacheKeys.viewBuffer,
          CacheKeys.viewFlushBatch(batchId),
          batchId
        ),
      cacheUnavailable.during('snapshotViews')
    );

    return await andThenAsync(
      pending,
      async (id): Promise<Result<ViewBatch | null, CacheUnavailable>> => {
        if (typeof id !== 'string') return ok(null);
        const hash = await fromPromise(
          () => this.redis.hgetall(CacheKeys.viewFlushBatch(id)),
          cacheUnavailable.during('snapshotViews')
        );
        return map(hash, (fields) => ({ batchId: id, counts: countsFromBuffer(fields) }));
      }
    );
  }

  private recordCall(view: ViewEvent): [string, number, ...Array<string | number>] {
    return [
      VIEW_BUFFER_SCRIPTS.record,
      2,
      CacheKeys.viewDedup(view.videoId, view.viewDate),
      CacheKeys.viewBuffer,
      view.viewerId,
      this.dedupTtlSeconds,
      viewBufferField(view.videoId, view.viewDate, 'views'),
      viewBufferField(view.videoId, view.viewDate, 'watch'),
      view.watchSeconds,
    ];
  }

  async recordRetention({
    videoId,
    sessionId,
    percent,
  }: RetentionMilestone): Promise<Result<void, CacheUnavailable>> {
    const recorded = await fromPromise(
      () =>
        this.redis.eval(
          VIEW_BUFFER_SCRIPTS.recordRetention,
          2,
          CacheKeys.retentionSession(videoId, sessionId),
          CacheKeys.retentionBuffer,
          percent,
          RETENTION_STEP_PERCENT,
          this.dedupTtlSeconds,
          videoId
        ),
      cacheUnavailable.during('recordRetention')
    );

    return map(recorded, () => undefined);
  }

  async drainRetention(): Promise<Result<RetentionCount[], CacheUnavailable>> {
    const flat = await fromPromise(
      () => this.redis.eval(VIEW_BUFFER_SCRIPTS.drainRetention, 1, CacheKeys.retentionBuffer),
      cacheUnavailable.during('drainRetention')
    );

    return map(flat, (reply) => {
      const entries = Array.isArray(reply) ? reply.map(String) : [];
      const hash: Record<string, string> = {};
      for (let index = 0; index + 1 < entries.length; index += 2) {
        hash[entries[index] ?? ''] = entries[index + 1] ?? '';
      }
      return retentionFromBuffer(hash);
    });
  }

  async release(batchId: string): Promise<Result<void, CacheUnavailable>> {
    const done = await fromPromise(
      () =>
        this.redis.eval(
          VIEW_BUFFER_SCRIPTS.release,
          2,
          CacheKeys.viewFlushPointer,
          CacheKeys.viewFlushBatch(batchId),
          batchId
        ),
      cacheUnavailable.during('releaseViews')
    );

    return map(done, () => undefined);
  }
}
