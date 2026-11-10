import type { WatchPartyMember, WatchPartyMemberRole, WatchPartyRoom } from '@vp/domain';
import { asCdnBase } from '@vp/env-schema';
import {
  heldRoleIds,
  toMembershipView,
  toPartyVideoView,
  toRosterEntry,
  toWatchPartyView,
} from '../watch-party-views';
import { START } from './watch-party-test-deps';

const CDN = asCdnBase('http://cdn.test/public');
const AT = new Date(START);
const ROOM_ID = '018f0000-0000-7000-8000-00000000c001';

const room = (overrides: Partial<WatchPartyRoom> = {}): WatchPartyRoom => ({
  id: ROOM_ID,
  name: 'Movie night',
  visibility: 'unlisted',
  capacity: null,
  allowGuests: true,
  chatEnabled: true,
  slowModeSeconds: 0,
  bufferPolicy: 'wait',
  autoplay: true,
  skipVotePercent: 50,
  idleClose: '15m',
  language: null,
  accent: null,
  scheduledFor: null,
  autoStart: false,
  ownerKey: 'user:owner',
  asChannelId: null,
  passwordHash: null,
  phase: 'lobby',
  playback: { itemId: null, phase: 'lobby', positionMs: 0, rate: 1, anchorAt: 0 },
  playbackVersion: 0,
  rolesVersion: 0,
  permissionsVersion: 1,
  queueLength: 0,
  queueVersion: 0,
  currentVideoId: null,
  presentCount: 0,
  status: 'open',
  closedReason: null,
  hiddenAt: null,
  version: 1,
  createdAt: AT,
  updatedAt: AT,
  startedAt: null,
  lastPresentAt: null,
  closedAt: null,
  ...overrides,
});

const OWNER_PERSON = { memberKey: 'user:owner', name: 'Olivia', avatarUrl: null };

const seat = (overrides: Partial<WatchPartyMember> = {}): WatchPartyMember => ({
  roomId: ROOM_ID,
  memberKey: 'user:member',
  kind: 'user',
  userId: 'member',
  discordUserId: null,
  displayName: null,
  avatarUrl: null,
  ipHash: null,
  joinedVia: 'link',
  joinedAt: AT,
  leftAt: null,
  ...overrides,
});

describe('apps/server/api/services: toWatchPartyView', () => {
  it.each([
    {
      scenario: 'a room with no limit shows the operator ceiling',
      input: {},
      expected: { capacity: null, effectiveCapacity: 200, hasPassword: false },
    },
    {
      scenario: 'a room with a limit shows it',
      input: { capacity: 12 },
      expected: { capacity: 12, effectiveCapacity: 12 },
    },
    {
      scenario: 'a limit above the ceiling shows the ceiling',
      input: { capacity: 500 },
      expected: { effectiveCapacity: 200 },
    },
    {
      scenario: 'a password shows only that there is one',
      input: { passwordHash: 'scrypt$secret' },
      expected: { hasPassword: true },
    },
    {
      scenario: 'dates travel as ISO strings',
      input: { scheduledFor: new Date('2026-04-01T20:00:00.000Z'), startedAt: AT },
      expected: {
        scheduledFor: '2026-04-01T20:00:00.000Z',
        startedAt: AT.toISOString(),
        createdAt: AT.toISOString(),
      },
    },
  ])('$scenario', ({ input, expected }) => {
    const view = toWatchPartyView({
      room: room(input),
      owner: OWNER_PERSON,
      currentVideo: null,
      ceiling: 200,
    });

    expect(view).toMatchObject(expected);
    expect(view).not.toHaveProperty('passwordHash');
    expect(view.owner).toEqual(OWNER_PERSON);
  });
});

describe('apps/server/api/services: toPartyVideoView', () => {
  const video = { id: 'v1', title: 'First', durationMs: 90_000 };

  it.each([
    {
      scenario: 'a custom thumbnail first',
      keys: { customThumbnailKey: 'c.jpg', posterKey: 'p.jpg' },
      url: 'http://cdn.test/public/c.jpg',
    },
    { scenario: 'the poster', keys: { posterKey: 'p.jpg' }, url: 'http://cdn.test/public/p.jpg' },
    { scenario: 'nothing', keys: {}, url: null },
  ])('points at $scenario', ({ keys, url }) => {
    const view = toPartyVideoView({ ...video, ...keys }, CDN);

    expect(view).toEqual({ id: 'v1', title: 'First', durationMs: 90_000, thumbnailUrl: url });
  });
});

describe('apps/server/api/services: heldRoleIds', () => {
  const assignment = (overrides: Partial<WatchPartyMemberRole>): WatchPartyMemberRole => ({
    roomId: ROOM_ID,
    memberKey: 'user:member',
    roleId: 'role-1',
    grantedBy: 'user:owner',
    expiresAt: null,
    createdAt: AT,
    ...overrides,
  });

  it('keeps the member’s own unexpired roles and drops the rest', () => {
    const rows = [
      assignment({ roleId: 'forever' }),
      assignment({ roleId: 'later', expiresAt: new Date(AT.getTime() + 1) }),
      assignment({ roleId: 'lapsed', expiresAt: new Date(AT.getTime() - 1) }),
      assignment({ roleId: 'expiring now', expiresAt: AT }),
      assignment({ roleId: 'theirs', memberKey: 'user:other' }),
    ];

    expect(heldRoleIds(rows, 'user:member', AT)).toEqual(['forever', 'later']);
  });
});

describe('apps/server/api/services: toMembershipView and toRosterEntry', () => {
  it('names a membership with its roles and what they allow', () => {
    const view = toMembershipView(seat(), 'Max', ['role-1'], {
      permissions: ['chat.post'],
      topPosition: 100,
    });

    expect(view).toEqual({
      roomId: ROOM_ID,
      memberKey: 'user:member',
      kind: 'user',
      name: 'Max',
      joinedVia: 'link',
      roleIds: ['role-1'],
      permissions: ['chat.post'],
    });
  });

  it.each([
    { phase: 'lobby' as const, sync: 'lobby' },
    { phase: 'playing' as const, sync: 'in_sync' },
    { phase: 'paused' as const, sync: 'in_sync' },
  ])('puts a seat in $sync while the room is $phase, at rest otherwise', ({ phase, sync }) => {
    const entry = toRosterEntry(
      seat(),
      { memberKey: 'user:member', name: 'Max', avatarUrl: null },
      ['r'],
      {
        phase,
      }
    );

    expect(entry).toEqual({
      memberKey: 'user:member',
      kind: 'user',
      source: 'app',
      name: 'Max',
      avatarUrl: null,
      roleIds: ['r'],
      ready: false,
      sync,
      voice: 'off',
      away: false,
    });
  });
});
