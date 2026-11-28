import type { Result } from '@kit/result';
import type { WatchPartyRoom } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

/** What the sweep reads and removes across every room, never the rows of one. */
export interface WatchPartyHousekeepingRepositoryPort {
  /** Open rooms in id order, the first `limit` after `afterId`; `null` starts from the first. */
  listOpen(
    afterId: string | null,
    limit: number
  ): Promise<Result<WatchPartyRoom[], DatabaseUnavailable>>;
  /**
   * Rewrites every open room's `trend_score` from its joins in the last 30 minutes, its present
   * count and its age at `at`, so the trending sort is an index walk.
   */
  refreshTrendScores(at: Date): Promise<Result<void, DatabaseUnavailable>>;
  /** The database's own clock, what pod clocks are measured against. */
  databaseClock(): Promise<Result<Date, DatabaseUnavailable>>;
  /** Rooms closed before `cutoff`, with everything that belongs to them; the count removed. */
  purgeClosedBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>>;
  /** Chat and system lines sent before `cutoff`, in every room; the count removed. */
  purgeMessagesBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>>;
}
