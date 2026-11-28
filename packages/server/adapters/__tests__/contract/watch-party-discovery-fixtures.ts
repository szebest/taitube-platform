import { expectOk } from '@kit/testing/result';
import type { WatchPartyRoomSeed } from '@vp/core/repositories';
import {
  lobbyPlayback,
  type WatchPartyDiscoveryFilters,
  type WatchPartyDiscoveryQuery,
  watchPartySearchText,
  REPORTS_TO_HIDE_ROOM,
} from '@vp/domain';
import {
  CATEGORY_GAMING_ID,
  CATEGORY_MUSIC_ID,
  OTHER_OWNER_CHANNEL_ID,
  OTHER_OWNER_ID,
  OWNER_CHANNEL_ID,
  OWNER_ID,
  publicVideo,
  seedCategories,
  VIDEO_IDS,
} from './fixtures';
import type { RepositoriesSubject } from './subjects';
import { accountId, numberedId } from './watch-party-activity-fixtures';
import { AT, later, OTHER_KEY, OWNER_KEY, roomSeed } from './watch-party-fixtures';

export const NOW = later(10);
const CEILING = 200;

export const room = (n: number) => `00000000-0000-7000-8000-0000000d${String(n).padStart(4, '0')}`;
const item = (roomNumber: number, index: number) =>
  `00000000-0000-7000-8000-0000000e${String(roomNumber).padStart(2, '0')}${String(index).padStart(2, '0')}`;

/** Rooms 1 to 6 are listed; the rest are the ones discovery must never show. */
export const LISTED = [1, 2, 3, 4, 5, 6].map(room);
export const MOVIE = room(1);
export const GAMING = room(2);
export const LATE = room(3);
export const TWIN_ONE = room(4);
export const TWIN_TWO = room(5);
export const SOLO = room(6);
const BANNED_FROM = room(12);

const OWNERS = {
  [OWNER_KEY]: { id: OWNER_ID, handle: 'owner', name: 'Owner' },
  [OTHER_KEY]: { id: OTHER_OWNER_ID, handle: 'other', name: 'Other' },
} as const;

interface RoomPlan {
  readonly n: number;
  readonly name: string;
  readonly ownerKey: typeof OWNER_KEY | typeof OTHER_KEY;
  readonly videoIds: readonly string[];
  readonly present?: number;
  readonly createdAt?: Date;
  readonly settings?: Partial<WatchPartyRoomSeed['room']>;
  readonly playing?: boolean;
  readonly close?: boolean;
}

const VIDEOS = {
  heat: VIDEO_IDS.c,
  speedrun: VIDEO_IDS.d,
  unlisted: VIDEO_IDS.e,
  quiet: VIDEO_IDS.f,
} as const;

const PLANS: readonly RoomPlan[] = [
  {
    n: 1,
    name: 'Movie night',
    ownerKey: OWNER_KEY,
    videoIds: [VIDEOS.heat],
    present: 3,
    createdAt: later(1),
    settings: { language: 'en' },
  },
  {
    n: 2,
    name: 'Gaming marathon',
    ownerKey: OWNER_KEY,
    videoIds: [VIDEOS.speedrun, VIDEO_IDS.a, VIDEO_IDS.b],
    present: 12,
    createdAt: later(2),
    playing: true,
    settings: {
      language: 'pl',
      passwordHash: 'scrypt:hash',
      capacity: 12,
      asChannelId: OWNER_CHANNEL_ID,
    },
  },
  {
    n: 3,
    name: 'Late show',
    ownerKey: OTHER_KEY,
    videoIds: [],
    present: 60,
    createdAt: later(3),
    settings: { language: 'en', scheduledFor: later(120) },
  },
  {
    n: 4,
    name: 'Twin one',
    ownerKey: OTHER_KEY,
    videoIds: [VIDEOS.quiet],
    present: 12,
    createdAt: later(2),
    settings: { scheduledFor: later(120) },
  },
  {
    n: 5,
    name: 'Twin two',
    ownerKey: OTHER_KEY,
    videoIds: [VIDEOS.quiet],
    present: 12,
    createdAt: later(2),
    settings: { scheduledFor: later(240) },
  },
  { n: 6, name: 'Solo', ownerKey: OWNER_KEY, videoIds: [VIDEOS.quiet], createdAt: later(4) },
  {
    n: 7,
    name: 'Unlisted room',
    ownerKey: OWNER_KEY,
    videoIds: [VIDEOS.quiet],
    settings: { visibility: 'unlisted' },
  },
  {
    n: 8,
    name: 'Private room',
    ownerKey: OWNER_KEY,
    videoIds: [VIDEOS.quiet],
    settings: { visibility: 'private' },
  },
  { n: 9, name: 'Closed room', ownerKey: OWNER_KEY, videoIds: [VIDEOS.quiet], close: true },
  { n: 10, name: 'Hidden room', ownerKey: OWNER_KEY, videoIds: [VIDEOS.quiet] },
  { n: 11, name: 'Unlisted video room', ownerKey: OWNER_KEY, videoIds: [VIDEOS.unlisted] },
  { n: 12, name: 'Banned from room', ownerKey: OWNER_KEY, videoIds: [VIDEOS.quiet] },
];

function seedOf(plan: RoomPlan): WatchPartyRoomSeed {
  const id = room(plan.n);
  const base = roomSeed({ id, ownerKey: plan.ownerKey });
  const queue = plan.videoIds.map((videoId, index) => ({
    id: item(plan.n, index + 1),
    roomId: id,
    videoId,
    addedBy: plan.ownerKey,
    startMs: 0,
    createdAt: AT,
  }));
  return {
    ...base,
    room: {
      ...base.room,
      name: plan.name,
      visibility: 'public',
      createdAt: plan.createdAt ?? AT,
      playback: lobbyPlayback(queue[0]?.id ?? null),
      ...plan.settings,
    },
    owner: { ...base.owner, userId: OWNERS[plan.ownerKey].id, joinedAt: AT },
    queue,
  };
}

async function seedRoom(subject: RepositoriesSubject, plan: RoomPlan): Promise<void> {
  const { repositories } = subject;
  const id = room(plan.n);
  const created = expectOk(await repositories.watchPartyRooms.create(seedOf(plan)));
  const owner = OWNERS[plan.ownerKey];
  const video = plan.videoIds[0]
    ? expectOk(await repositories.videos.findById(plan.videoIds[0]))
    : null;
  expectOk(
    await repositories.watchPartyRooms.setSearchText(
      id,
      watchPartySearchText({
        name: plan.name,
        ownerHandle: owner.handle,
        ownerName: owner.name,
        videoTitle: video?.title ?? null,
      })
    )
  );
  expectOk(await repositories.watchPartyRooms.recordPresence(id, plan.present ?? 0, AT));
  if (plan.playing) {
    expectOk(
      await repositories.watchPartyRooms.commitPlayback(id, {
        expected: { playbackVersion: 0, rolesVersion: 0 },
        playback: { ...created.playback, phase: 'playing', anchorAt: AT.getTime() },
        line: null,
        at: AT,
      })
    );
  }
  if (plan.close) expectOk(await repositories.watchPartyRooms.close(id, 'owner', null, AT));
}

/** The real hide path: the third open room report from a distinct account takes the room out of the list. */
async function hideByReports(subject: RepositoriesSubject, roomId: string): Promise<void> {
  const { repositories } = subject;
  for (let n = 3; n < 3 + REPORTS_TO_HIDE_ROOM; n++) {
    const reporterId = accountId(n);
    expectOk(
      await repositories.users.upsert({
        id: reporterId,
        email: `reporter${n}@video-pipeline.local`,
      })
    );
    expectOk(
      await repositories.watchPartyReports.file(
        {
          id: numberedId(13, n),
          roomId,
          reporterId,
          targetKey: null,
          context: 'room',
          reason: 'spam',
          details: null,
          createdAt: AT,
        },
        REPORTS_TO_HIDE_ROOM,
        AT
      )
    );
  }
}

/** Every plan above as rooms, the videos they play, the hidden and the banned-from one. */
export async function seedDiscoveryWorld(subject: RepositoriesSubject): Promise<void> {
  const { repositories } = subject;
  await seedCategories(repositories);
  const videos = [
    { id: VIDEOS.heat, title: 'Heat', categoryId: CATEGORY_MUSIC_ID },
    { id: VIDEOS.speedrun, title: 'Speedrun finals', categoryId: CATEGORY_GAMING_ID },
    { id: VIDEOS.unlisted, title: 'Hidden gem', visibility: 'unlisted' as const },
    { id: VIDEOS.quiet, title: 'Quiet hours', categoryId: CATEGORY_MUSIC_ID },
  ];
  for (const video of videos) await subject.seedVideo(publicVideo(video));
  for (const plan of PLANS) await seedRoom(subject, plan);
  await hideByReports(subject, room(10));
  expectOk(
    await repositories.watchPartyMembers.ban(
      {
        roomId: BANNED_FROM,
        memberKey: OTHER_KEY,
        ipHash: null,
        bannedBy: OWNER_KEY,
        reason: null,
        createdAt: AT,
      },
      {
        id: item(99, 1),
        line: { event: 'banned', actorKey: OWNER_KEY, targetKey: OTHER_KEY, detail: null },
        videoId: null,
        positionMs: null,
        createdAt: AT,
      }
    )
  );
  expectOk(await repositories.watchPartyHousekeeping.refreshTrendScores(NOW));
}

export async function follow(subject: RepositoriesSubject): Promise<void> {
  expectOk(
    await subject.repositories.subscriptions.subscribe(
      OTHER_OWNER_ID,
      OTHER_OWNER_CHANNEL_ID,
      OWNER_CHANNEL_ID
    )
  );
}

const NO_FILTERS: WatchPartyDiscoveryFilters = {
  text: null,
  status: 'all',
  categoryId: null,
  language: null,
  access: 'any',
  size: 'any',
  space: false,
  followed: false,
  creator: false,
  kind: 'any',
};

export type DiscoveryOverrides = Partial<Omit<WatchPartyDiscoveryQuery, 'filters'>> & {
  filters?: Partial<WatchPartyDiscoveryFilters>;
};

export function discoveryQuery(overrides: DiscoveryOverrides = {}): WatchPartyDiscoveryQuery {
  const { filters, ...rest } = overrides;
  return {
    filters: { ...NO_FILTERS, ...filters },
    sort: 'members',
    mode: 'lexical',
    viewerId: OTHER_OWNER_ID,
    ceiling: CEILING,
    now: NOW,
    after: null,
    limit: 50,
    ...rest,
  };
}
