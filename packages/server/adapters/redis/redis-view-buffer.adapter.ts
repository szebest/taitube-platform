import type {
  PlaybackWatch,
  PlaybackWatchOutcome,
  RetentionMilestone,
  ViewBufferPort,
  ViewEvent,
  ViewRecordOutcome,
} from '@vp/core/ports';
import { RETENTION_STEP_PERCENT, type ViewBatch } from '@vp/domain';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { type Result, andThen, andThenAsync, err, fromPromise, map, ok } from '@vp/result';
import type { Redis } from 'ioredis';
import {
  countsFromBuffer,
  hourlyFromBuffer,
  hourlyViewField,
  retentionFromBuffer,
  viewBufferField,
} from './view-buffer-fields';

/**
 * Each script runs atomically on the server. `record` must not count a viewer the dedup sketch
 * already holds, and `snapshot` must move every buffer and point at the batch in one step: split
 * either across round trips and a concurrent beacon or a crashed flush loses or doubles a view.
 */
export const VIEW_BUFFER_SCRIPTS = {
  record: `
local added = redis.call('PFADD', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
if added == 1 then
  redis.call('HINCRBY', KEYS[2], ARGV[3], 1)
  redis.call('HINCRBY', KEYS[3], ARGV[4], 1)
end
return added`,
  recordPlayback: `
local watched = tonumber(redis.call('HINCRBYFLOAT', KEYS[1], 'watched', ARGV[4]))
local credited = tonumber(redis.call('HGET', KEYS[1], 'credited') or '0')
local whole = math.floor(watched)
if whole > credited then
  redis.call('HINCRBY', KEYS[3], ARGV[3], whole - credited)
  redis.call('HSET', KEYS[1], 'credited', whole)
end
redis.call('EXPIRE', KEYS[1], ARGV[2])
if watched < tonumber(ARGV[5]) then return -1 end
if redis.call('HSETNX', KEYS[1], 'counted', 1) == 0 then return -1 end
local added = redis.call('PFADD', KEYS[2], ARGV[1])
redis.call('EXPIRE', KEYS[2], ARGV[2])
if added == 1 then
  redis.call('HINCRBY', KEYS[3], ARGV[6], 1)
  redis.call('HINCRBY', KEYS[4], ARGV[7], 1)
end
return added`,
  snapshot: `
local pending = redis.call('GET', KEYS[1])
if pending then return pending end
local views = redis.call('EXISTS', KEYS[2])
local retention = redis.call('EXISTS', KEYS[4])
local hourly = redis.call('EXISTS', KEYS[6])
if views == 0 and retention == 0 and hourly == 0 then return false end
if views == 1 then redis.call('RENAME', KEYS[2], KEYS[3]) end
if retention == 1 then redis.call('RENAME', KEYS[4], KEYS[5]) end
if hourly == 1 then redis.call('RENAME', KEYS[6], KEYS[7]) end
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
  release: `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('DEL', KEYS[1], KEYS[2], KEYS[3], KEYS[4])
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

function playbackOutcomeOf(reply: unknown): PlaybackWatchOutcome {
  if (reply === 1) return 'counted';
  return reply === 0 ? 'duplicate' : 'pending';
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

  async recordPlayback({
    videoId,
    sessionId,
    viewDate,
    viewHour,
    watchedSeconds,
    requiredSeconds,
  }: PlaybackWatch): Promise<Result<PlaybackWatchOutcome, CacheUnavailable>> {
    const reply = await fromPromise(
      () =>
        this.redis.eval(
          VIEW_BUFFER_SCRIPTS.recordPlayback,
          4,
          CacheKeys.viewSession(videoId, sessionId),
          CacheKeys.viewDedup(videoId, viewDate),
          CacheKeys.viewBuffer,
          CacheKeys.hourlyViewBuffer,
          sessionId,
          this.dedupTtlSeconds,
          viewBufferField(videoId, viewDate, 'watch'),
          watchedSeconds,
          requiredSeconds,
          viewBufferField(videoId, viewDate, 'views'),
          hourlyViewField(videoId, viewHour)
        ),
      cacheUnavailable.during('recordPlayback')
    );

    return map(reply, playbackOutcomeOf);
  }

  async snapshot(batchId: string): Promise<Result<ViewBatch | null, CacheUnavailable>> {
    const pending = await fromPromise(
      () =>
        this.redis.eval(
          VIEW_BUFFER_SCRIPTS.snapshot,
          7,
          CacheKeys.viewFlushPointer,
          CacheKeys.viewBuffer,
          CacheKeys.viewFlushBatch(batchId),
          CacheKeys.retentionBuffer,
          CacheKeys.retentionFlushBatch(batchId),
          CacheKeys.hourlyViewBuffer,
          CacheKeys.hourlyViewFlushBatch(batchId),
          batchId
        ),
      cacheUnavailable.during('snapshotViews')
    );

    return await andThenAsync(
      pending,
      async (id): Promise<Result<ViewBatch | null, CacheUnavailable>> => {
        if (typeof id !== 'string') return ok(null);
        const staged = await fromPromise(
          () =>
            Promise.all([
              this.redis.hgetall(CacheKeys.viewFlushBatch(id)),
              this.redis.hgetall(CacheKeys.retentionFlushBatch(id)),
              this.redis.hgetall(CacheKeys.hourlyViewFlushBatch(id)),
            ]),
          cacheUnavailable.during('snapshotViews')
        );
        return map(staged, ([views, retention, hourly]) => ({
          batchId: id,
          counts: countsFromBuffer(views),
          retention: retentionFromBuffer(retention),
          hourly: hourlyFromBuffer(hourly),
        }));
      }
    );
  }

  private recordCall(view: ViewEvent): [string, number, ...Array<string | number>] {
    return [
      VIEW_BUFFER_SCRIPTS.record,
      3,
      CacheKeys.viewDedup(view.videoId, view.viewDate),
      CacheKeys.viewBuffer,
      CacheKeys.hourlyViewBuffer,
      view.viewerId,
      this.dedupTtlSeconds,
      viewBufferField(view.videoId, view.viewDate, 'views'),
      hourlyViewField(view.videoId, view.viewHour),
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

  async release(batchId: string): Promise<Result<void, CacheUnavailable>> {
    const done = await fromPromise(
      () =>
        this.redis.eval(
          VIEW_BUFFER_SCRIPTS.release,
          4,
          CacheKeys.viewFlushPointer,
          CacheKeys.viewFlushBatch(batchId),
          CacheKeys.retentionFlushBatch(batchId),
          CacheKeys.hourlyViewFlushBatch(batchId),
          batchId
        ),
      cacheUnavailable.during('releaseViews')
    );

    return map(done, () => undefined);
  }
}
