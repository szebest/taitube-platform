import type { ListWatchHistoryOptions, WatchHistoryRepositoryPort } from '@vp/core/repositories';
import type { NewWatchProgress, WatchHistoryEntry, WatchProgress } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, ok } from '@vp/result';
import { type VideoLookups, keepWatchable } from './watchable-video';

type KeysetRow = { watchedAt: Date; id: string };

function compareNewestFirst(a: KeysetRow, b: KeysetRow): number {
  return b.watchedAt.getTime() - a.watchedAt.getTime() || b.id.localeCompare(a.id);
}

export class InMemoryWatchHistoryRepository implements WatchHistoryRepositoryPort {
  private readonly rows = new Map<string, NewWatchProgress>();

  constructor(private readonly lookups: VideoLookups) {}

  async record(progress: NewWatchProgress): Promise<Result<void, DatabaseUnavailable>> {
    const key = this.key(progress.userId, progress.videoId);
    const stored = this.rows.get(key);
    if (!stored) {
      this.rows.set(key, { ...progress });
    } else if (stored.watchedAt <= progress.watchedAt) {
      const { id: _id, ...latest } = progress;
      Object.assign(stored, latest);
    }
    return ok();
  }

  async find(
    userId: string,
    videoId: string
  ): Promise<Result<WatchProgress | null, DatabaseUnavailable>> {
    const stored = this.rows.get(this.key(userId, videoId));
    if (!stored) return ok(null);
    const { videoId: id, progressSeconds, durationSeconds, watchedAt } = stored;
    return ok({ videoId: id, progressSeconds, durationSeconds, watchedAt });
  }

  async findMany(
    userId: string,
    videoIds: readonly string[]
  ): Promise<Result<WatchProgress[], DatabaseUnavailable>> {
    const found = await Promise.all(videoIds.map((videoId) => this.find(userId, videoId)));
    return ok(found.flatMap((result) => (result.ok && result.value ? [result.value] : [])));
  }

  /** Per video, how many viewers watched it and `videoId` both. */
  coWatchers(videoId: string): Map<string, number> {
    const watchers = new Set(
      [...this.rows.values()].filter((row) => row.videoId === videoId).map((row) => row.userId)
    );
    const counts = new Map<string, number>();
    for (const row of this.rows.values()) {
      if (row.videoId === videoId || !watchers.has(row.userId)) continue;
      counts.set(row.videoId, (counts.get(row.videoId) ?? 0) + 1);
    }
    return counts;
  }

  async list(
    viewer: UserContext,
    { cursor, limit }: ListWatchHistoryOptions
  ): Promise<Result<WatchHistoryEntry[], DatabaseUnavailable>> {
    const mine = this.of(viewer.id)
      .sort(compareNewestFirst)
      .filter((row) => !cursor || compareNewestFirst(cursor, row) < 0);

    const rows = mine.map(({ userId: _userId, ...row }) => row);
    return ok(await keepWatchable(this.lookups, viewer, rows, limit));
  }

  async remove(userId: string, videoId: string): Promise<Result<boolean, DatabaseUnavailable>> {
    return ok(this.rows.delete(this.key(userId, videoId)));
  }

  async removeAll(userId: string): Promise<Result<string[], DatabaseUnavailable>> {
    const removed = this.of(userId);
    for (const row of removed) this.rows.delete(this.key(userId, row.videoId));
    return ok(removed.map((row) => row.videoId));
  }

  clear(): void {
    this.rows.clear();
  }

  private of(userId: string): NewWatchProgress[] {
    return [...this.rows.values()].filter((row) => row.userId === userId);
  }

  private key(userId: string, videoId: string): string {
    return `${userId}/${videoId}`;
  }
}
