import type { WatchPartyBan, WatchPartyMember } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { NewSystemLine, NewWatchPartyMember } from './watch-party-room-repository';

export interface SeatMove {
  readonly roomId: string;
  readonly fromKey: string;
  /** The seat as the new identity holds it; `joinedVia` and `joinedAt` carry over from the old one. */
  readonly to: Pick<
    WatchPartyMember,
    'memberKey' | 'kind' | 'userId' | 'discordUserId' | 'displayName' | 'avatarUrl'
  >;
  readonly at: Date;
}

export interface WatchPartyMemberRepositoryPort {
  /** A seat that was left too: `leftAt` says so. */
  find(
    roomId: string,
    memberKey: string
  ): Promise<Result<WatchPartyMember | null, DatabaseUnavailable>>;
  listSeated(roomId: string): Promise<Result<WatchPartyMember[], DatabaseUnavailable>>;
  /** Takes the seat, or takes a left one back keeping how it was first gained. */
  join(
    member: NewWatchPartyMember,
    line: NewSystemLine | null
  ): Promise<Result<WatchPartyMember, DatabaseUnavailable>>;
  /** Whether a held seat was left; a kick is a leave with its own line. */
  leave(
    roomId: string,
    memberKey: string,
    line: NewSystemLine | null,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Every guest seat goes; answers the keys that left. */
  removeGuests(
    roomId: string,
    line: NewSystemLine,
    at: Date
  ): Promise<Result<string[], DatabaseUnavailable>>;
  /** Also leaves the seat and drops the member's roles, in one transaction. */
  ban(ban: WatchPartyBan, line: NewSystemLine): Promise<Result<void, DatabaseUnavailable>>;
  unban(roomId: string, memberKey: string): Promise<Result<boolean, DatabaseUnavailable>>;
  /** By member key, or by a guest's IP hash when one is given. */
  isBanned(
    roomId: string,
    memberKey: string,
    ipHash: string | null
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /**
   * A seat upgrade in one transaction: the seat, its role rows (a union with any the new key holds)
   * and any ban on the old key move to the new one; the old seat is gone. `ok(null)` when the old
   * key holds no seat here.
   */
  moveSeat(move: SeatMove): Promise<Result<WatchPartyMember | null, DatabaseUnavailable>>;
  /** Open rooms an account holds a seat in. */
  openRoomIdsOf(userId: string): Promise<Result<string[], DatabaseUnavailable>>;
}
