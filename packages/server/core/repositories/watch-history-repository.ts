import type { NewWatchProgress, WatchHistoryEntry, WatchProgress } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import type { Result } from '@vp/result';

interface WatchHistoryCursor {
  watchedAt: Date;
  id: string;
}

export interface ListWatchHistoryOptions {
  cursor: WatchHistoryCursor | null;
  limit: number;
}

/**
 * One row per user and video. A write carrying an older `watchedAt` than the stored one is dropped,
 * so a late flush from a stale tab never rewinds a newer playhead.
 */
export interface WatchHistoryRepositoryPort {
  record(progress: NewWatchProgress): Promise<Result<void, DatabaseUnavailable>>;
  find(userId: string, videoId: string): Promise<Result<WatchProgress | null, DatabaseUnavailable>>;
  /** Newest first, only videos the viewer may still watch, up to `limit + 1` rows. */
  list(
    viewer: UserContext,
    options: ListWatchHistoryOptions
  ): Promise<Result<WatchHistoryEntry[], DatabaseUnavailable>>;
  remove(userId: string, videoId: string): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Answers the videos that were in the history, so their buffered playheads can go too. */
  removeAll(userId: string): Promise<Result<string[], DatabaseUnavailable>>;
}
