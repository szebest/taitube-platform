import type { WatchPartyServerFrame, WatchPartyView } from '@vp/api-contracts';
import { VIDEO_ID } from './fixtures';

const partyId = (index: number) => `0190c3a0-5e1d-7000-8000-${String(index).padStart(12, '0')}`;

const userKey = (index: number) => ['user', partyId(index)].join(':');

export const PARTY_ID = partyId(0x9001);
export const PARTY_VIEWER_KEY = userKey(0x9101);
export const PARTY_OWNER_KEY = userKey(0x9102);
const PARTY_ITEM_ID = partyId(0x9201);

export function partyRoom(overrides: Partial<WatchPartyView> = {}): WatchPartyView {
  return {
    id: PARTY_ID,
    name: 'Movie night',
    owner: { memberKey: PARTY_OWNER_KEY, name: 'Ana', avatarUrl: null },
    asChannelId: null,
    visibility: 'unlisted',
    hasPassword: false,
    capacity: null,
    effectiveCapacity: 200,
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
    phase: 'lobby',
    currentVideo: {
      id: VIDEO_ID,
      title: 'Big Buck Bunny',
      durationMs: 600_000,
      thumbnailUrl: null,
    },
    queueLength: 1,
    presentCount: 2,
    status: 'open',
    closedReason: null,
    version: 1,
    createdAt: '2026-11-05T10:00:00.000Z',
    startedAt: null,
    ...overrides,
  };
}

/** What a member who holds `permissions` through Member's role hears first on joining the room. */
export function partyHello(
  overrides: Partial<Extract<WatchPartyServerFrame, { type: 'hello' }>> = {}
): WatchPartyServerFrame {
  const memberRoleId = partyId(0x9301);
  return {
    type: 'hello',
    room: partyRoom(),
    roles: [
      {
        id: memberRoleId,
        key: 'member',
        kind: 'grant',
        name: 'Member',
        colour: null,
        position: 1,
        permissions: ['chat.post', 'chat.react'],
        memberCount: 2,
        updatedAt: '2026-11-05T10:00:00.000Z',
      },
    ],
    rolesVersion: 1,
    you: { memberKey: PARTY_VIEWER_KEY, kind: 'user', roleIds: [] },
    playback: { itemId: PARTY_ITEM_ID, phase: 'lobby', positionMs: 0, rate: 1, anchorAt: 0 },
    version: 1,
    serverNow: 1_000,
    queue: { items: [], version: 1 },
    roster: {
      entries: [
        {
          memberKey: PARTY_VIEWER_KEY,
          kind: 'user',
          source: 'app',
          name: 'Me',
          avatarUrl: null,
          roleIds: [],
          ready: false,
          sync: 'lobby',
          voice: 'off',
          away: false,
        },
        {
          memberKey: PARTY_OWNER_KEY,
          kind: 'user',
          source: 'app',
          name: 'Ana',
          avatarUrl: null,
          roleIds: [],
          ready: true,
          sync: 'lobby',
          voice: 'off',
          away: false,
        },
      ],
      guests: 0,
    },
    chat: { resume: 'fresh', mode: { enabled: true, slowModeSeconds: 0 }, pinned: null },
    ...overrides,
  };
}
