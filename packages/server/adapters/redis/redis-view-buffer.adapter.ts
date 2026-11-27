import { type Result, andThen, andThenAsync, err, fromPromise, map, ok } from '@kit/result';
import type {
  ExperimentEvent,
  PlaybackWatch,
  PlaybackWatchOutcome,
  PlaylistBufferEvent,
  PlaylistOpen,
  RetentionMilestone,
  ShareLinkOpen,
  ViewBufferPort,
  ViewEvent,
  ViewRecordOutcome,
} from '@vp/core/ports';
import { RETENTION_STEP_PERCENT, type ViewBatch } from '@vp/domain';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import type { Redis } from 'ioredis';
import { playlistEventField, playlistField, playlistsFromBuffer } from './playlist-buffer-fields';
import {
  countsFromBuffer,
  deviceViewField,
  devicesFromBuffer,
  experimentField,
  experimentsFromBuffer,
  hourlyFromBuffer,
  hourlyViewField,
  retentionFromBuffer,
  shareLinkField,
  shareLinksFromBuffer,
  viewBufferField,
} from './view-buffer-fields';
import { VIEW_BUFFER_SCRIPTS } from './view-buffer-scripts';

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
    device,
    watchedSeconds,
    requiredSeconds,
    shareLinkId,
    experiment,
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
          hourlyViewField(videoId, viewHour),
          deviceViewField(videoId, viewDate, device),
          shareLinkId ? shareLinkField(videoId, viewDate, 'watch', shareLinkId) : '',
          shareLinkId ? shareLinkField(videoId, viewDate, 'views', shareLinkId) : '',
          experiment
            ? experimentField(
                videoId,
                viewDate,
                'watch',
                experiment.experimentId,
                experiment.variantId
              )
            : ''
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
          devices: devicesFromBuffer(views),
          shareLinks: shareLinksFromBuffer(views),
          experiments: experimentsFromBuffer(views),
          playlists: playlistsFromBuffer(views),
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

  async recordShareLinkOpen({
    targetId,
    linkId,
    viewerKey,
    viewDate,
  }: ShareLinkOpen): Promise<Result<ViewRecordOutcome, CacheUnavailable>> {
    const added = await fromPromise(
      () =>
        this.redis.eval(
          VIEW_BUFFER_SCRIPTS.recordShareLinkOpen,
          2,
          CacheKeys.shareLinkOpenDedup(linkId, viewDate),
          CacheKeys.viewBuffer,
          viewerKey,
          this.dedupTtlSeconds,
          shareLinkField(targetId, viewDate, 'opens', linkId)
        ),
      cacheUnavailable.during('recordShareLinkOpen')
    );

    return map(added, outcomeOf);
  }

  async recordExperimentEvents(
    events: readonly ExperimentEvent[]
  ): Promise<Result<void, CacheUnavailable>> {
    if (events.length === 0) return ok();

    const replies = await fromPromise(
      () =>
        events
          .reduce(
            (pipeline, { videoId, viewDate, measure, experimentId, variantId }) =>
              pipeline.hincrby(
                CacheKeys.viewBuffer,
                experimentField(videoId, viewDate, measure, experimentId, variantId),
                1
              ),
            this.redis.pipeline()
          )
          .exec(),
      cacheUnavailable.during('recordExperimentEvents')
    );

    return andThen(replies, (settled): Result<void, CacheUnavailable> => {
      const failed = (settled ?? []).find(([error]) => error !== null);
      if (!settled || failed) return err(cacheUnavailable('recordExperimentEvents', failed?.[0]));
      return ok();
    });
  }

  async recordPlaylistOpen({
    playlistId,
    viewerKey,
    viewDate,
  }: PlaylistOpen): Promise<Result<ViewRecordOutcome, CacheUnavailable>> {
    const added = await fromPromise(
      () =>
        this.redis.eval(
          VIEW_BUFFER_SCRIPTS.recordShareLinkOpen,
          2,
          CacheKeys.playlistOpenDedup(playlistId, viewDate),
          CacheKeys.viewBuffer,
          viewerKey,
          this.dedupTtlSeconds,
          playlistField(playlistId, viewDate, 'opens', null)
        ),
      cacheUnavailable.during('recordPlaylistOpen')
    );

    return map(added, outcomeOf);
  }

  async recordPlaylistEvents(
    events: readonly PlaylistBufferEvent[]
  ): Promise<Result<void, CacheUnavailable>> {
    if (events.length === 0) return ok();

    const replies = await fromPromise(
      () =>
        events
          .reduce(
            (pipeline, event) =>
              pipeline.hincrby(CacheKeys.viewBuffer, playlistEventField(event), 1),
            this.redis.pipeline()
          )
          .exec(),
      cacheUnavailable.during('recordPlaylistEvents')
    );

    return andThen(replies, (settled): Result<void, CacheUnavailable> => {
      const failed = (settled ?? []).find(([error]) => error !== null);
      if (!settled || failed) return err(cacheUnavailable('recordPlaylistEvents', failed?.[0]));
      return ok();
    });
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
