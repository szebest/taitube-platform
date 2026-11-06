import type { WatchPartyInvite } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { NewOutboxInput } from './outbox-repository';

export type InviteWrite =
  | { readonly type: 'sent'; readonly invite: WatchPartyInvite }
  /** A pending invite to the same person in the same room: renewed, no second notification. */
  | { readonly type: 'folded'; readonly invite: WatchPartyInvite };

export interface WatchPartyInviteRepositoryPort {
  /** `notify` lands in the outbox in the same transaction, and only for a `sent` invite. */
  create(
    invite: WatchPartyInvite,
    notify: NewOutboxInput
  ): Promise<Result<InviteWrite, DatabaseUnavailable>>;
  findById(id: string): Promise<Result<WatchPartyInvite | null, DatabaseUnavailable>>;
  /** A pending, unexpired invite of this account to this room: the per-recipient grant. */
  findValid(
    roomId: string,
    inviteeId: string,
    now: Date
  ): Promise<Result<WatchPartyInvite | null, DatabaseUnavailable>>;
  /** Pending, declined and joined, newest first; the inviter is shown a decline as pending. */
  listForRoom(roomId: string): Promise<Result<WatchPartyInvite[], DatabaseUnavailable>>;
  countPending(roomId: string, now: Date): Promise<Result<number, DatabaseUnavailable>>;
  revoke(roomId: string, inviteId: string): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Only the invitee declines; answers the invite it declined. */
  decline(
    inviteeId: string,
    inviteId: string
  ): Promise<Result<WatchPartyInvite | null, DatabaseUnavailable>>;
  markJoined(inviteId: string): Promise<Result<void, DatabaseUnavailable>>;
}
