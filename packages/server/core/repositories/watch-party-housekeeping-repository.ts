import type { WatchPartyRoom } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/** What the sweep reads and removes across every room, never the rows of one. */
export interface WatchPartyHousekeepingRepositoryPort {
  /** Open rooms in id order, the first `limit` after `afterId`; `null` starts from the first. */
  listOpen(
    afterId: string | null,
    limit: number
  ): Promise<Result<WatchPartyRoom[], DatabaseUnavailable>>;
  /** Rooms closed before `cutoff`, with everything that belongs to them; the count removed. */
  purgeClosedBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>>;
  /** Chat and system lines sent before `cutoff`, in every room; the count removed. */
  purgeMessagesBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>>;
}
