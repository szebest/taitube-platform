import type { PositionWrite, WatchPartyQueueItem } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { NewSystemLine, NewWatchPartyQueueItem } from './watch-party-room-repository';

export interface QueueSnapshot {
  /** Not removed, in play order, played ones included. */
  readonly items: WatchPartyQueueItem[];
  readonly version: number;
}

export type QueueWrite =
  | { readonly type: 'applied'; readonly queue: QueueSnapshot }
  | { readonly type: 'full' }
  | { readonly type: 'missing' };

/** Every edit bumps the room's `queue_version` and `queue_length` in its transaction. */
export interface WatchPartyQueueRepositoryPort {
  list(roomId: string): Promise<Result<QueueSnapshot, DatabaseUnavailable>>;
  /** Appends after the last item, refused whole when the room would pass `limit` unplayed items. */
  append(
    roomId: string,
    items: readonly NewWatchPartyQueueItem[],
    limit: number
  ): Promise<Result<QueueWrite, DatabaseUnavailable>>;
  /** The writes `movePositions` computed. */
  move(
    roomId: string,
    writes: readonly PositionWrite[]
  ): Promise<Result<QueueWrite, DatabaseUnavailable>>;
  remove(
    roomId: string,
    itemId: string,
    line: NewSystemLine | null,
    at: Date
  ): Promise<Result<QueueWrite, DatabaseUnavailable>>;
  /** Unplayed items a member added: `queue.add` alone holds three. */
  countPendingBy(roomId: string, memberKey: string): Promise<Result<number, DatabaseUnavailable>>;
}
