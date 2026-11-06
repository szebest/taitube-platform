import {
  type BuiltInRoleKey,
  type MemberKind,
  type RoomRole,
  builtInRoles,
  effectivePermissions,
} from '@vp/domain';
import {
  type UserContext,
  type WatchPartyAbility,
  getWatchPartyPermissions,
  toWatchPartyViewer,
} from '@vp/permissions';

export const ROOM_ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

/** The custom role section 15's second table seeds: below Moderator, with three management permissions. */
const ORGANIZER: RoomRole = {
  id: 'organizer',
  key: null,
  kind: 'grant',
  name: 'Organizer',
  colour: null,
  position: 450,
  permissions: ['roles.manage', 'roles.assign', 'chat.moderate'],
};

export const ROLES: RoomRole[] = [
  ...builtInRoles('friends').map((role) => ({ ...role, id: role.key ?? '' })),
  ORGANIZER,
];

export function roleOf(id: BuiltInRoleKey | 'organizer'): RoomRole {
  const role = ROLES.find((candidate) => candidate.id === id);
  if (!role) throw new Error(`no role ${id}`);
  return role;
}

export type Holder = BuiltInRoleKey | 'organizer';

/** A seat holding `holder` (Member alone for `member`, nothing but Guest for `guest`). */
export function seatOf(holder: Holder, user: UserContext | null = null) {
  const kind: MemberKind = holder === 'guest' ? 'guest' : 'user';
  const isOwner = holder === 'owner';
  const implicit = holder === 'owner' || holder === 'member' || holder === 'guest';
  const effective = effectivePermissions({
    kind,
    isOwner,
    roles: ROLES,
    assignments: implicit ? [] : [{ roleId: holder, expiresAt: null }],
    now: new Date(),
  });
  const ability: WatchPartyAbility = getWatchPartyPermissions(
    user,
    toWatchPartyViewer({ kind, isOwner, effective })
  );
  return { ability, topPosition: effective.topPosition, isOwner };
}

export function memberAt(
  topPosition: number,
  overrides: { kind?: MemberKind; isOwner?: boolean; memberKey?: string } = {}
) {
  return {
    memberKey: 'user:target',
    kind: 'user' as const,
    isOwner: false,
    topPosition,
    ...overrides,
  };
}
