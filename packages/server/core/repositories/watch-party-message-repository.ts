import type { WatchPartyMessage } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export type NewWatchPartyMessage = Omit<WatchPartyMessage, 'pinned' | 'removedAt'>;

/** A room's chat and system lines, removed lines left out of every read. */
export interface WatchPartyMessageRepositoryPort {
  append(message: NewWatchPartyMessage): Promise<Result<WatchPartyMessage, DatabaseUnavailable>>;
  /** Oldest first: after `afterId` the first `limit`; with no cursor, the newest `limit`. */
  listAfter(
    roomId: string,
    afterId: string | null,
    limit: number
  ): Promise<Result<WatchPartyMessage[], DatabaseUnavailable>>;
  /** Lines removed at or after the time `afterId` was sent: what a resuming client may still show. */
  listRemovedSince(
    roomId: string,
    afterId: string,
    limit: number
  ): Promise<Result<string[], DatabaseUnavailable>>;
  /** A line of the room that is not removed. */
  find(
    roomId: string,
    messageId: string
  ): Promise<Result<WatchPartyMessage | null, DatabaseUnavailable>>;
  remove(
    roomId: string,
    messageId: string,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Pins one line, unpinning any other; `null` unpins. Answers the pinned line, if any. */
  pin(
    roomId: string,
    messageId: string | null
  ): Promise<Result<WatchPartyMessage | null, DatabaseUnavailable>>;
  findPinned(roomId: string): Promise<Result<WatchPartyMessage | null, DatabaseUnavailable>>;
}
