import type { WatchPartyMemberRole, WatchPartyRoleRecord } from '@vp/domain';
import { memberRolesFrame, toRoleList, toRoleView } from '../watch-party-role-views';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const KEY = 'user:00000000-0000-7000-8000-00000000f002';

const role = (overrides: Partial<WatchPartyRoleRecord> = {}) => ({
  id: '018f0000-0000-7000-8000-000000000001',
  roomId: 'room',
  key: null,
  kind: 'grant' as const,
  name: 'Popcorn crew',
  colour: '#aabbcc',
  position: 450,
  permissions: ['chat.pin' as const],
  createdAt: NOW,
  updatedAt: NOW,
  memberCount: 3,
  ...overrides,
});

const row = (roleId: string, expiresAt: Date | null, memberKey = KEY): WatchPartyMemberRole => ({
  roomId: 'room',
  memberKey,
  roleId,
  grantedBy: 'user:someone',
  expiresAt,
  createdAt: NOW,
});

describe('toRoleView', () => {
  it('carries the wire fields and drops the room and creation time', () => {
    expect(toRoleView(role())).toEqual({
      id: '018f0000-0000-7000-8000-000000000001',
      key: null,
      kind: 'grant',
      name: 'Popcorn crew',
      colour: '#aabbcc',
      position: 450,
      permissions: ['chat.pin'],
      memberCount: 3,
      updatedAt: '2026-03-01T12:00:00.000Z',
    });
  });
});

describe('toRoleList', () => {
  it('keeps the order it is given and names both versions', () => {
    const list = toRoleList([role({ position: 600 }), role({ position: 450 })], {
      rolesVersion: 4,
      permissionsVersion: 1,
    });

    expect(list.items.map(({ position }) => position)).toEqual([600, 450]);
    expect(list).toMatchObject({ rolesVersion: 4, permissionsVersion: 1 });
  });
});

describe('memberRolesFrame', () => {
  it.each([
    {
      scenario: 'a timed role keeps its expiry and a party-long one has none',
      rows: [row('timed', new Date(NOW.getTime() + 60_000)), row('forever', null)],
      roleIds: ['timed', 'forever'],
      expiries: { timed: '2026-03-01T12:01:00.000Z', forever: null },
    },
    {
      scenario: 'an expired row is left out',
      rows: [row('gone', new Date(NOW.getTime() - 1)), row('kept', null)],
      roleIds: ['kept'],
      expiries: { kept: null },
    },
    {
      scenario: 'another member row is left out',
      rows: [row('theirs', null, 'user:someone-else'), row('mine', null)],
      roleIds: ['mine'],
      expiries: { mine: null },
    },
  ])('$scenario', ({ rows, roleIds, expiries }) => {
    expect(memberRolesFrame(KEY, rows, 7, NOW)).toEqual({
      type: 'member.roles',
      memberKey: KEY,
      roleIds,
      expiries,
      rolesVersion: 7,
    });
  });
});
