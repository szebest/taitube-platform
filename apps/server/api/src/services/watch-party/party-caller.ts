import type { PartyGuestSession } from '@vp/core/ports';
import { type MemberKey, memberKeyOf, type PartyPrincipal } from '@vp/domain';
import type { UserContext } from '@vp/permissions';

/**
 * Who is asking, as the auth plugin resolved them: a session, a party credential (only on a
 * `partyGuest` route), both during a seat upgrade, or neither. `ip` is the transport's address.
 */
export interface PartyCaller {
  readonly user: UserContext | null;
  readonly party: PartyGuestSession | null;
  readonly ip: string;
}

/** The account wins over a party credential: a guest who signed in acts as the account. */
export function principalOf({ user, party }: PartyCaller): PartyPrincipal | null {
  if (user) return { kind: 'user', userId: user.id };
  return party?.principal ?? null;
}

export function memberKeyOfCaller(caller: PartyCaller): MemberKey | null {
  const principal = principalOf(caller);
  return principal === null ? null : memberKeyOf(principal);
}
