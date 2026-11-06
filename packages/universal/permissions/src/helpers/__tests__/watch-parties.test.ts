import {
  type BuiltInRoleKey,
  BUILT_IN_ROLES,
  type RoomRole,
  WATCH_PARTY_PERMISSION_IDS,
  type WatchPartyPermission,
  builtInRoles,
  effectivePermissions,
} from '@vp/domain';
import { moderatorUser, standardUser } from '../../__mocks__/fixtures';
import { toWatchPartyViewer } from '../../normalizers/index';
import type { UserContext, WatchPartyMemberSubject } from '../../types/index';
import {
  canActOnMember,
  canCreateWatchParty,
  canGrantPermission,
  canInRoom,
  canReadWatchParty,
  canTouchRole,
  getWatchPartyPermissions,
} from '../watch-parties';

const ROLES: RoomRole[] = builtInRoles('friends').map((role) => ({ ...role, id: role.key ?? '' }));
const ORGANIZER: RoomRole = {
  id: 'organizer',
  key: null,
  kind: 'grant',
  name: 'Organizer',
  colour: null,
  position: 450,
  permissions: ['roles.manage', 'roles.assign', 'chat.moderate'],
};

type Holder = BuiltInRoleKey | 'organizer' | 'guest-seat' | 'no-seat';

function abilityOf(holder: Holder, user: UserContext | null = standardUser) {
  if (holder === 'no-seat') return getWatchPartyPermissions(user, toWatchPartyViewer(null));
  const kind = holder === 'guest-seat' ? 'guest' : 'user';
  const isOwner = holder === 'owner';
  const assignments =
    holder === 'guest-seat' || isOwner ? [] : [{ roleId: holder, expiresAt: null }];
  const effective = effectivePermissions({
    kind,
    isOwner,
    roles: [...ROLES, ORGANIZER],
    assignments,
    now: new Date(),
  });
  return getWatchPartyPermissions(user, toWatchPartyViewer({ kind, isOwner, effective }));
}

const roleAt = (key: BuiltInRoleKey) => {
  const role = BUILT_IN_ROLES.find((candidate) => candidate.key === key);
  return { key, position: role?.position ?? 0 };
};
const memberAt = (topPosition: number, overrides: Partial<WatchPartyMemberSubject> = {}) => ({
  topPosition,
  isOwner: false,
  kind: 'user' as const,
  ...overrides,
});

describe('helpers/watch-parties: the room-scoped ability', () => {
  it.each(WATCH_PARTY_PERMISSION_IDS.map((permission) => ({ permission })))(
    'turns a held $permission into an action on the room, and nothing else',
    ({ permission }) => {
      const viewer = {
        permissions: [permission],
        topPosition: 1,
        isOwner: false,
        kind: 'user' as const,
      };
      const ability = getWatchPartyPermissions(standardUser, viewer);
      const others = WATCH_PARTY_PERMISSION_IDS.filter((id) => id !== permission);

      expect(canInRoom(ability, permission)).toBe(true);
      expect(others.filter((id) => canInRoom(ability, id))).toEqual([]);
    }
  );

  it.each<{ holder: Holder; permission: WatchPartyPermission; grant: boolean }>([
    { holder: 'organizer', permission: 'chat.moderate', grant: true },
    { holder: 'organizer', permission: 'room.close', grant: false },
    { holder: 'moderator', permission: 'roles.manage', grant: false },
    { holder: 'owner', permission: 'room.close', grant: true },
  ])('$holder may put $permission into a role: $grant', ({ holder, permission, grant }) => {
    expect(canGrantPermission(abilityOf(holder), permission)).toBe(grant);
  });

  it.each<{
    holder: Holder;
    action: 'assign' | 'revoke' | 'update' | 'delete' | 'move';
    role: BuiltInRoleKey;
    allowed: boolean;
  }>([
    { holder: 'organizer', action: 'update', role: 'moderator', allowed: false },
    { holder: 'organizer', action: 'move', role: 'moderator', allowed: false },
    { holder: 'organizer', action: 'delete', role: 'moderator', allowed: false },
    { holder: 'organizer', action: 'assign', role: 'moderator', allowed: false },
    { holder: 'organizer', action: 'revoke', role: 'moderator', allowed: false },
    { holder: 'organizer', action: 'assign', role: 'chat_muted', allowed: false },
    { holder: 'organizer', action: 'assign', role: 'dj', allowed: true },
    { holder: 'organizer', action: 'update', role: 'dj', allowed: true },
    { holder: 'organizer', action: 'update', role: 'owner', allowed: false },
    { holder: 'moderator', action: 'assign', role: 'cohost', allowed: false },
    { holder: 'moderator', action: 'assign', role: 'chat_muted', allowed: true },
    { holder: 'moderator', action: 'assign', role: 'voice_muted', allowed: true },
    { holder: 'moderator', action: 'assign', role: 'dj', allowed: true },
    { holder: 'moderator', action: 'update', role: 'dj', allowed: false },
    { holder: 'cohost', action: 'update', role: 'dj', allowed: false },
    { holder: 'cohost', action: 'assign', role: 'moderator', allowed: true },
    { holder: 'dj', action: 'assign', role: 'speaker', allowed: false },
    { holder: 'owner', action: 'assign', role: 'cohost', allowed: true },
    { holder: 'owner', action: 'assign', role: 'owner', allowed: false },
    { holder: 'owner', action: 'assign', role: 'member', allowed: false },
  ])('$holder may $action $role: $allowed', ({ holder, action, role, allowed }) => {
    expect(canTouchRole(abilityOf(holder), action, roleAt(role))).toBe(allowed);
  });

  it.each<{
    holder: Holder;
    action: 'kick' | 'ban' | 'mute' | 'assign';
    member: WatchPartyMemberSubject;
    allowed: boolean;
  }>([
    { holder: 'organizer', action: 'mute', member: memberAt(600), allowed: false },
    { holder: 'moderator', action: 'kick', member: memberAt(600), allowed: false },
    { holder: 'moderator', action: 'ban', member: memberAt(400), allowed: true },
    { holder: 'moderator', action: 'mute', member: memberAt(800), allowed: false },
    { holder: 'moderator', action: 'kick', member: memberAt(0, { kind: 'guest' }), allowed: true },
    {
      holder: 'moderator',
      action: 'assign',
      member: memberAt(0, { kind: 'guest' }),
      allowed: false,
    },
    { holder: 'owner', action: 'mute', member: memberAt(0, { kind: 'guest' }), allowed: false },
    { holder: 'cohost', action: 'kick', member: memberAt(1000, { isOwner: true }), allowed: false },
    { holder: 'member', action: 'kick', member: memberAt(1), allowed: false },
  ])(
    '$holder may $action a member at $member.topPosition: $allowed',
    ({ holder, action, member, allowed }) => {
      expect(canActOnMember(abilityOf(holder), action, member)).toBe(allowed);
    }
  );

  it('clamps a guest seat to the ceiling', () => {
    const ability = abilityOf('guest-seat');

    expect(WATCH_PARTY_PERMISSION_IDS.filter((id) => canInRoom(ability, id))).toEqual([
      'voice.join',
    ]);
  });

  describe('for platform staff', () => {
    const staff = abilityOf('no-seat', moderatorUser);

    it.each([
      'chat.moderate',
      'voice.moderate',
      'members.kick',
      'members.ban',
      'room.close',
    ] as const)('holds %s in any room', (permission) => {
      expect(canInRoom(staff, permission)).toBe(true);
    });

    it.each([
      { action: 'kick' as const, member: memberAt(800), allowed: true },
      { action: 'mute' as const, member: memberAt(800), allowed: true },
      { action: 'ban' as const, member: memberAt(1000, { isOwner: true }), allowed: false },
    ])('may $action a member at $member.topPosition: $allowed', ({ action, member, allowed }) => {
      expect(canActOnMember(staff, action, member)).toBe(allowed);
    });

    it.each([
      { role: 'chat_muted' as const, allowed: true },
      { role: 'dj' as const, allowed: false },
    ])('may assign $role: $allowed', ({ role, allowed }) => {
      expect(canTouchRole(staff, 'assign', roleAt(role))).toBe(allowed);
    });

    it('cannot touch roles', () => {
      expect(canInRoom(staff, 'roles.manage')).toBe(false);
    });
  });
});

describe('helpers/watch-parties: the principal-level checks', () => {
  it.each([
    { who: 'an account', user: standardUser, create: true },
    { who: 'a visitor', user: null, create: false },
  ])('$who may create a room: $create', ({ user, create }) => {
    expect(canCreateWatchParty(user)).toBe(create);
  });

  it.each([
    { scenario: 'an unlisted room', room: { visibility: 'unlisted' as const }, read: true },
    {
      scenario: 'a private room without a grant',
      room: { visibility: 'private' as const },
      read: false,
    },
  ])('a visitor may read $scenario: $read', ({ room, read }) => {
    expect(canReadWatchParty(null, room)).toBe(read);
  });
});
