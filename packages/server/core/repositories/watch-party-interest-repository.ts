import type { Result } from '@kit/result';
import type { DatabaseUnavailable } from '@vp/errors';

export interface WatchPartyInterestRepositoryPort {
  /** Idempotent: asking twice keeps the first row. */
  add(roomId: string, userId: string, at: Date): Promise<Result<void, DatabaseUnavailable>>;
  remove(roomId: string, userId: string): Promise<Result<void, DatabaseUnavailable>>;
  /** Everyone interested in the room, oldest first. */
  userIdsOf(roomId: string): Promise<Result<string[], DatabaseUnavailable>>;
  /** The open rooms the account is interested in, newest interest first. */
  openRoomIdsOf(userId: string): Promise<Result<string[], DatabaseUnavailable>>;
}
