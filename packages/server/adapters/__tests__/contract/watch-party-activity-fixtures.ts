import type { WatchPartyRoomSeed } from '@vp/core/repositories';
import {
  builtInRoles,
  lobbyPlayback,
  QUICK_PARTY_SETTINGS,
  WATCH_PARTY_PERMISSIONS_VERSION,
  type WatchPartyRoom,
} from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { RepositoriesSubject } from './subjects';

export const AT = new Date('2026-03-01T12:00:00.000Z');
export const MINUTE_MS = 60_000;

export const ROOM_ID = '00000000-0000-7000-8000-00000000d001';
export const OTHER_ROOM_ID = '00000000-0000-7000-8000-00000000d002';
export const OWNER_KEY = `user:${OWNER_ID}`;

export const numberedId = (prefix: number, n: number) =>
  `00000000-0000-7000-8000-${String(prefix).padStart(4, '0')}${String(n).padStart(8, '0')}`;

/** Accounts beyond the two owners, numbered from 3. */
export const accountId = (n: number) => numberedId(3, n);
export const userKey = (userId: string) => `user:${userId}`;

const EXTRA_ACCOUNTS = 8;

function roomSeed(roomId: string): WatchPartyRoomSeed {
  return {
    room: {
      ...QUICK_PARTY_SETTINGS,
      id: roomId,
      name: 'Movie night',
      ownerKey: OWNER_KEY,
      asChannelId: null,
      passwordHash: null,
      playback: lobbyPlayback(null),
      permissionsVersion: WATCH_PARTY_PERMISSIONS_VERSION,
      createdAt: AT,
    },
    roles: builtInRoles('friends').map((role) => ({ ...role, id: uuidv7() })),
    owner: {
      roomId,
      memberKey: OWNER_KEY,
      kind: 'user',
      userId: OWNER_ID,
      discordUserId: null,
      displayName: null,
      avatarUrl: null,
      joinedVia: 'owner',
      joinedAt: AT,
    },
    queue: [],
  };
}

export async function createRoom(
  subject: RepositoriesSubject,
  roomId: string
): Promise<WatchPartyRoom> {
  return expectOk(await subject.repositories.watchPartyRooms.create(roomSeed(roomId)));
}

/** The two owners, accounts 3 to 10, three ready videos and one empty room. */
export async function seedRoomWorld(subject: RepositoriesSubject): Promise<WatchPartyRoom> {
  const { repositories } = subject;
  await seedOwners(repositories);
  for (let n = 3; n < 3 + EXTRA_ACCOUNTS; n++) {
    await repositories.users.upsert({
      id: accountId(n),
      email: `account${n}@video-pipeline.local`,
    });
  }
  for (const id of [VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c]) {
    await subject.seedVideo(publicVideo({ id }));
  }
  return createRoom(subject, ROOM_ID);
}
