import {
  WATCH_PARTY_PERMISSION_IDS,
  type WatchPartyPermission,
  type WatchPartyPermissionEntry,
} from '../watch-party-permissions';
import {
  type EffectivePermissionsInput,
  type RoomRole,
  type WatchPartyPreset,
  builtInRoles,
  effectivePermissions,
  upgradeRoomRoles,
} from '../watch-party-roles';

const ALL = [...WATCH_PARTY_PERMISSION_IDS].sort();
const NOW = new Date('2026-11-06T20:00:00Z');
const FRIENDS_MEMBER: WatchPartyPermission[] = [
  'playback.control',
  'playback.request',
  'queue.add',
  'queue.reorder',
  'queue.remove',
  'queue.skip',
  'queue.vote',
  'chat.post',
  'chat.react',
  'members.invite',
  'voice.join',
  'voice.speak',
];
const PUBLIC_MEMBER: WatchPartyPermission[] = [
  'playback.request',
  'queue.vote',
  'chat.post',
  'chat.react',
  'voice.join',
];

function roomRoles(preset: WatchPartyPreset = 'friends'): RoomRole[] {
  return builtInRoles(preset).map((role) => ({ ...role, id: role.key ?? role.name }));
}

const sorted = (permissions: readonly string[]) => [...permissions].sort();

describe('@vp/domain: the built-in roles', () => {
  it.each([
    { key: 'owner', kind: 'grant', position: 1000, permissions: ALL },
    {
      key: 'cohost',
      kind: 'grant',
      position: 800,
      permissions: ALL.filter((id) => id !== 'roles.manage' && id !== 'room.close'),
    },
    {
      key: 'moderator',
      kind: 'grant',
      position: 600,
      permissions: [
        'chat.pin',
        'chat.moderate',
        'chat.bypassSlowMode',
        'voice.moderate',
        'members.invite',
        'members.kick',
        'members.ban',
        'members.joinWhenFull',
        'roles.assign',
      ],
    },
    {
      key: 'chat_muted',
      kind: 'restrict',
      position: 520,
      permissions: ['chat.post', 'chat.react'],
    },
    { key: 'voice_muted', kind: 'restrict', position: 510, permissions: ['voice.speak'] },
    { key: 'spectator', kind: 'restrict', position: 500, permissions: ALL },
    {
      key: 'dj',
      kind: 'grant',
      position: 400,
      permissions: ['playback.control', 'queue.add', 'queue.reorder', 'queue.remove', 'queue.skip'],
    },
    { key: 'speaker', kind: 'grant', position: 300, permissions: ['voice.speak'] },
    {
      key: 'vip',
      kind: 'grant',
      position: 200,
      permissions: ['members.joinWhenFull', 'chat.bypassSlowMode', 'chat.pin'],
    },
    { key: 'member', kind: 'grant', position: 1, permissions: FRIENDS_MEMBER },
    { key: 'guest', kind: 'grant', position: 0, permissions: ['voice.join'] },
  ])('$key is a $kind role at $position', ({ key, kind, position, permissions }) => {
    const role = builtInRoles('friends').find((candidate) => candidate.key === key);

    expect(role).toMatchObject({ kind, position });
    expect(sorted(role?.permissions ?? [])).toEqual(sorted(permissions));
  });

  it.each([
    { preset: 'friends' as const, member: FRIENDS_MEMBER },
    { preset: 'public' as const, member: PUBLIC_MEMBER },
  ])('gives Member the $preset preset and leaves every other role alone', ({ preset, member }) => {
    const roles = builtInRoles(preset);
    const others = (list: typeof roles) => list.filter((role) => role.key !== 'member');

    expect(sorted(roles.find((role) => role.key === 'member')?.permissions ?? [])).toEqual(
      sorted(member)
    );
    expect(others(roles)).toEqual(others(builtInRoles('friends')));
  });
});

describe('@vp/domain: effectivePermissions', () => {
  const roles = roomRoles();
  const custom: RoomRole = {
    id: 'organizer',
    key: null,
    kind: 'grant',
    name: 'Organizer',
    colour: null,
    position: 450,
    permissions: ['roles.manage', 'chat.moderate'],
  };
  const inTen = new Date(NOW.getTime() + 600_000);
  const tenAgo = new Date(NOW.getTime() - 600_000);

  function effectiveOf(overrides: Partial<EffectivePermissionsInput> = {}) {
    return effectivePermissions({
      kind: 'user',
      isOwner: false,
      roles: [...roles, custom],
      assignments: [],
      now: NOW,
      ...overrides,
    });
  }

  const without = (...removed: string[]) => FRIENDS_MEMBER.filter((id) => !removed.includes(id));

  it.each([
    { scenario: 'Member only', overrides: {}, permissions: FRIENDS_MEMBER, top: 1 },
    {
      scenario: 'Member plus a grant role',
      overrides: { assignments: [{ roleId: 'organizer', expiresAt: null }] },
      permissions: [...FRIENDS_MEMBER, 'roles.manage', 'chat.moderate'],
      top: 450,
    },
    {
      scenario: 'Chat muted, voice untouched',
      overrides: { assignments: [{ roleId: 'chat_muted', expiresAt: inTen }] },
      permissions: without('chat.post', 'chat.react'),
      top: 1,
    },
    {
      scenario: 'Voice muted, chat untouched',
      overrides: { assignments: [{ roleId: 'voice_muted', expiresAt: null }] },
      permissions: without('voice.speak'),
      top: 1,
    },
    {
      scenario: 'both mutes, the chat one expired',
      overrides: {
        assignments: [
          { roleId: 'chat_muted', expiresAt: tenAgo },
          { roleId: 'voice_muted', expiresAt: inTen },
        ],
      },
      permissions: without('voice.speak'),
      top: 1,
    },
    {
      scenario: 'Spectator',
      overrides: { assignments: [{ roleId: 'spectator', expiresAt: null }] },
      permissions: [],
      top: 1,
    },
    {
      scenario: 'an expired grant role',
      overrides: { assignments: [{ roleId: 'organizer', expiresAt: tenAgo }] },
      permissions: FRIENDS_MEMBER,
      top: 1,
    },
    {
      scenario: 'the owner with a restrict row',
      overrides: { isOwner: true, assignments: [{ roleId: 'spectator', expiresAt: null }] },
      permissions: ALL,
      top: 1000,
    },
    {
      scenario: 'a guest with a forged Co-host row',
      overrides: { kind: 'guest' as const, assignments: [{ roleId: 'cohost', expiresAt: null }] },
      permissions: ['voice.join'],
      top: 0,
    },
    {
      scenario: 'a forged Owner row',
      overrides: { assignments: [{ roleId: 'owner', expiresAt: null }] },
      permissions: FRIENDS_MEMBER,
      top: 1,
    },
  ])('$scenario', ({ overrides, permissions, top }) => {
    const effective = effectiveOf(overrides);

    expect(sorted(effective.permissions)).toEqual(sorted(permissions));
    expect(effective.topPosition).toBe(top);
  });

  it('clamps a guest to the ceiling even when Guest was edited past it', () => {
    const forged = roles.map((role) =>
      role.key === 'guest' ? { ...role, permissions: ['chat.post', 'voice.join'] as const } : role
    );

    expect(effectiveOf({ kind: 'guest', roles: forged }).permissions).toEqual(['voice.join']);
  });
});

describe('@vp/domain: upgradeRoomRoles', () => {
  const lights: WatchPartyPermissionEntry = {
    id: 'room.lights',
    group: 'room',
    since: 2,
    roles: ['cohost', 'dj'],
    member: ['friends', 'public'],
  };
  const registryV2 = [
    ...WATCH_PARTY_PERMISSION_IDS.map((id) => ({
      id,
      group: 'room' as const,
      since: 1,
      roles: [],
      member: [],
    })),
    lights,
  ];
  const custom: RoomRole = {
    id: 'organizer',
    key: null,
    kind: 'grant',
    name: 'Organizer',
    colour: null,
    position: 450,
    permissions: ['roles.manage'],
  };

  it('adds a version 2 permission to a version 1 room by its defaults, custom roles left out', () => {
    const { roles, version } = upgradeRoomRoles([...roomRoles(), custom], 1, registryV2);
    const holders = roles
      .filter((role) => (role.permissions as readonly string[]).includes('room.lights'))
      .map((role) => role.id);

    expect(version).toBe(2);
    expect(holders.sort()).toEqual(['cohost', 'dj', 'member', 'owner', 'spectator']);
  });

  it('changes nothing in a room already at the version', () => {
    const before = roomRoles();

    expect(upgradeRoomRoles(before, 2, registryV2)).toEqual({ roles: before, version: 2 });
  });
});
