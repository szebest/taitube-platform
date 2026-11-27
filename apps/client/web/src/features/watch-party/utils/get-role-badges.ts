import type { PartyRole, PartyRosterEntry } from '@vp/queries';

export interface RoleBadge {
  id: string;
  name: string;
  colour: string | null;
}

/** The roles a member holds that carry a colour, highest first: the ones their badges show. */
export function getRoleBadges(
  member: Pick<PartyRosterEntry, 'roleIds'> | undefined,
  roles: readonly Pick<PartyRole, 'id' | 'name' | 'colour' | 'position'>[]
): RoleBadge[] {
  if (!member) {
    return [];
  }

  return roles
    .filter((role) => role.colour !== null && member.roleIds.includes(role.id))
    .toSorted((first, second) => second.position - first.position)
    .map(({ id, name, colour }) => ({ id, name, colour }));
}
