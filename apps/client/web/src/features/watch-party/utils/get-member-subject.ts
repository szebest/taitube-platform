import type { PartyRole, PartyRosterEntry } from '@vp/queries';

export interface MemberSubject {
  topPosition: number;
  isOwner: boolean;
  kind: PartyRosterEntry['kind'];
}

/** A member as the room's rules see them: where their highest role sits, and whether they own the room. */
export function getMemberSubject(
  entry: Pick<PartyRosterEntry, 'kind' | 'memberKey' | 'roleIds'>,
  roles: readonly Pick<PartyRole, 'id' | 'position'>[],
  ownerKey: string
): MemberSubject {
  const held = roles.filter((role) => entry.roleIds.includes(role.id));

  return {
    topPosition: Math.max(0, ...held.map((role) => role.position)),
    isOwner: entry.memberKey === ownerKey,
    kind: entry.kind,
  };
}
