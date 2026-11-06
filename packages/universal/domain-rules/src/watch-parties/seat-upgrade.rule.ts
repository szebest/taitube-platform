import type { MemberKind } from '@vp/domain';
import {
  type WatchPartyBanned,
  type WatchPartyCredentialInvalid,
  type WatchPartyNotFound,
  watchPartyBanned,
  watchPartyCredentialInvalid,
  watchPartyNotFound,
} from '@vp/errors';
import { err, ok, type Result } from '@vp/result';

export interface WatchPartySeatUpgradeInput {
  readonly roomId: string;
  /** The guest credential holds a seat in this room. */
  readonly guestSeat: boolean;
  /** Who the seat moves to: the session's account, or a Discord party credential. */
  readonly next: MemberKind;
  /** The new key is banned here, or the guest was, since a guest ban carries to the new key. */
  readonly banned: boolean;
  /** The new key already holds a seat here, whose socket the upgraded one supersedes. */
  readonly hasSeat: boolean;
}

export function decideWatchPartySeatUpgrade(
  input: WatchPartySeatUpgradeInput
): Result<
  { readonly supersedes: boolean },
  WatchPartyNotFound | WatchPartyCredentialInvalid | WatchPartyBanned
> {
  const { roomId, guestSeat, next, banned, hasSeat } = input;
  if (!guestSeat) return err(watchPartyNotFound(roomId));
  if (next === 'guest') return err(watchPartyCredentialInvalid());
  if (banned) return err(watchPartyBanned(roomId));
  return ok({ supersedes: hasSeat });
}
