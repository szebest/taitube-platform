import type {
  RecordWatchProgressBody,
  WatchHistoryItemView,
  WatchProgressView,
} from '@vp/api-contracts';
import type { PlayheadCachePort } from '@vp/core/ports';
import type { VideoRepository, WatchHistoryRepositoryPort } from '@vp/core/repositories';
import { clampProgress, type WatchProgress } from '@vp/domain';
import { decideVideoRead, publicReadFailure } from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { err, ignore, isErr, isOk, map, ok, type Result } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';
import type { HistoryPause } from './history-pause';
import type { HomeService } from './home-service';
import { toWatchHistoryItemView, toWatchProgressView } from './library-views';
import type { SpriteGeometry } from './video-views';

type PublicReadFailure = ReturnType<typeof publicReadFailure>;

interface WatchHistoryPage {
  items: WatchHistoryItemView[];
  nextCursor: string | null;
}

export interface WatchHistoryServiceDeps {
  history: WatchHistoryRepositoryPort;
  pause: HistoryPause;
  videos: VideoRepository;
  playheads: PlayheadCachePort;
  home: Pick<HomeService, 'forget'>;
  paginator: Paginator;
  cdn: CdnBase;
  sprite: SpriteGeometry;
  flushIntervalMs: number;
  now: () => number;
}

/**
 * Resumable playheads over a write-behind buffer. A heartbeat touches Redis alone while the row it
 * last wrote is younger than the flush interval; the first beat, a later one past the interval, a
 * pause and the end write through. A dead cache costs a write, never an answer: without a buffer
 * to trust, every beat writes through. While the viewer has paused their history, no row is written.
 */
export class WatchHistoryService {
  constructor(private readonly deps: WatchHistoryServiceDeps) {}

  async record(
    viewer: UserContext,
    body: RecordWatchProgressBody
  ): Promise<Result<WatchProgressView, DatabaseUnavailable | PublicReadFailure>> {
    const { videoId, durationSeconds, reason } = body;
    const progress: WatchProgress = {
      videoId,
      progressSeconds: clampProgress(body.progressSeconds, durationSeconds),
      durationSeconds,
      watchedAt: new Date(this.deps.now()),
    };

    const lastFlush = reason === 'heartbeat' ? await this.lastFlush(viewer, videoId) : null;
    const buffered =
      lastFlush !== null &&
      progress.watchedAt.getTime() - lastFlush.getTime() < this.deps.flushIntervalMs;
    if (!buffered) {
      const readable = await this.readable(viewer, videoId);
      if (isErr(readable)) return readable;
      const paused = await this.deps.pause.isPaused(viewer.id);
      if (isErr(paused)) return paused;
      if (paused.value) return ok(toWatchProgressView(progress));
      const written = await this.deps.history.record({
        ...progress,
        id: uuidv7(),
        userId: viewer.id,
      });
      if (isErr(written)) return written;
      await this.deps.home.forget(viewer.id);
    }

    const flushedAt = buffered ? lastFlush : progress.watchedAt;
    ignore(
      await this.deps.playheads.write(viewer.id, { ...progress, flushedAt }),
      'the row is the authority; a missed buffer write sends the next beat through'
    );
    return ok(toWatchProgressView(progress));
  }

  async playhead(
    viewer: UserContext,
    videoId: string
  ): Promise<Result<{ playhead: WatchProgressView | null }, DatabaseUnavailable>> {
    const cached = await this.deps.playheads.read(viewer.id, videoId);
    if (isOk(cached) && cached.value) return ok({ playhead: toWatchProgressView(cached.value) });

    const stored = await this.deps.history.find(viewer.id, videoId);
    return map(stored, (found) => ({ playhead: found && toWatchProgressView(found) }));
  }

  async list(
    viewer: UserContext,
    query: { cursor?: string; limit?: number }
  ): Promise<Result<WatchHistoryPage, DatabaseUnavailable | InvalidCursor>> {
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
        toItem: (entry): WatchHistoryItemView =>
          toWatchHistoryItemView(entry, this.deps.cdn, this.deps.sprite),
      })
    );
  }

  async remove(viewer: UserContext, videoId: string): Promise<Result<void, DatabaseUnavailable>> {
    const removed = await this.deps.history.remove(viewer.id, videoId);
    if (isErr(removed)) return removed;
    await this.deps.home.forget(viewer.id);
    await this.forget(viewer, [videoId]);
    return ok();
  }

  async clear(viewer: UserContext): Promise<Result<void, DatabaseUnavailable>> {
    const removed = await this.deps.history.removeAll(viewer.id);
    if (isErr(removed)) return removed;
    await this.deps.home.forget(viewer.id);
    await this.forget(viewer, removed.value);
    return ok();
  }

  private async lastFlush(viewer: UserContext, videoId: string): Promise<Date | null> {
    const cached = await this.deps.playheads.read(viewer.id, videoId);
    return isOk(cached) && cached.value ? cached.value.flushedAt : null;
  }

  private async readable(
    viewer: UserContext,
    videoId: string
  ): Promise<Result<void, DatabaseUnavailable | PublicReadFailure>> {
    const video = await this.deps.videos.findById(videoId);
    if (isErr(video)) return video;
    const readable = decideVideoRead({ viewer, video: video.value, videoId });
    return isErr(readable) ? err(publicReadFailure(readable.error)) : ok();
  }

  private async forget(viewer: UserContext, videoIds: readonly string[]): Promise<void> {
    ignore(
      await this.deps.playheads.forget(viewer.id, videoIds),
      'the history row is gone; a stale playhead expires with its TTL'
    );
  }
}
