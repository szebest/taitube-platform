import type { RecordWatchProgressBody, WatchHistoryItemView } from '@vp/api-contracts';
import type { PlayheadCachePort } from '@vp/core/ports';
import type { VideoRepository, WatchHistoryRepositoryPort } from '@vp/core/repositories';
import { type WatchProgress, clampProgress } from '@vp/domain';
import { decideVideoRead, publicReadFailure } from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, err, ignore, isErr, isOk, map, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';
import { toWatchHistoryItemView, toWatchProgressView } from './library-views';

type PublicReadFailure = ReturnType<typeof publicReadFailure>;

export interface WatchHistoryServiceDeps {
  history: WatchHistoryRepositoryPort;
  videos: VideoRepository;
  playheads: PlayheadCachePort;
  paginator: Paginator;
  cdn: CdnBase;
}

/**
 * Resumable playheads over a write-behind buffer. A heartbeat touches Redis alone once the session
 * has a row; the first beat, a pause and the end write through. A dead cache costs a write, never
 * an answer: without a buffer to trust, every beat writes through.
 */
export class WatchHistoryService {
  constructor(private readonly deps: WatchHistoryServiceDeps) {}

  async record(viewer: UserContext, body: RecordWatchProgressBody) {
    const { videoId, durationSeconds, reason } = body;
    const progress: WatchProgress = {
      videoId,
      progressSeconds: clampProgress(body.progressSeconds, durationSeconds),
      durationSeconds,
      watchedAt: new Date(),
    };

    if (reason !== 'heartbeat' || !(await this.buffered(viewer, videoId))) {
      const written = await this.writeThrough(viewer, progress);
      if (isErr(written)) return written;
    }

    ignore(
      await this.deps.playheads.write(viewer.id, progress),
      'the row is the authority; a missed buffer write sends the next beat through'
    );
    return ok(toWatchProgressView(progress));
  }

  async playhead(viewer: UserContext, videoId: string) {
    const cached = await this.deps.playheads.read(viewer.id, videoId);
    if (isOk(cached) && cached.value) return ok({ playhead: toWatchProgressView(cached.value) });

    const stored = await this.deps.history.find(viewer.id, videoId);
    return map(stored, (found) => ({ playhead: found && toWatchProgressView(found) }));
  }

  async list(viewer: UserContext, query: { cursor?: string; limit?: number }) {
    const { paginator } = this.deps;
    const limit = paginator.limit(query.limit);
    const cursor = decodeCreatedAtCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await this.deps.history.list(viewer, {
      cursor: cursor.value && { watchedAt: cursor.value.createdAt, id: cursor.value.id },
      limit,
    });
    return map(rows, (entries) =>
      paginator.paginate(entries, limit, {
        cursorOf: (entry) => createdAtCursorPayload({ createdAt: entry.watchedAt, id: entry.id }),
        toItem: (entry): WatchHistoryItemView => toWatchHistoryItemView(entry, this.deps.cdn),
      })
    );
  }

  async remove(viewer: UserContext, videoId: string) {
    const removed = await this.deps.history.remove(viewer.id, videoId);
    if (isErr(removed)) return removed;
    await this.forget(viewer, [videoId]);
    return ok();
  }

  async clear(viewer: UserContext) {
    const removed = await this.deps.history.removeAll(viewer.id);
    if (isErr(removed)) return removed;
    await this.forget(viewer, removed.value);
    return ok();
  }

  private async buffered(viewer: UserContext, videoId: string): Promise<boolean> {
    const cached = await this.deps.playheads.read(viewer.id, videoId);
    return isOk(cached) && cached.value !== null;
  }

  private async writeThrough(
    viewer: UserContext,
    progress: WatchProgress
  ): Promise<Result<void, DatabaseUnavailable | PublicReadFailure>> {
    const { videoId } = progress;
    const video = await this.deps.videos.findById(videoId);
    if (isErr(video)) return video;
    const readable = decideVideoRead({ viewer, video: video.value, videoId });
    if (isErr(readable)) return err(publicReadFailure(readable.error));

    return await this.deps.history.record({ ...progress, id: uuidv7(), userId: viewer.id });
  }

  private async forget(viewer: UserContext, videoIds: readonly string[]): Promise<void> {
    ignore(
      await this.deps.playheads.forget(viewer.id, videoIds),
      'the history row is gone; a stale playhead expires with its TTL'
    );
  }
}
