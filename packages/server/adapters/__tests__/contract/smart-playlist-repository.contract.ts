import { expectOk } from '@kit/testing/result';
import type { SmartPlaylistCondition, SmartPlaylistRules } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import {
  CATEGORY_MUSIC_ID,
  HOUR_MS,
  OTHER_OWNER_CHANNEL_ID,
  OTHER_OWNER_ID,
  OWNER_CHANNEL_ID,
  OWNER_ID,
  VIDEO_IDS,
  publicVideo,
  seedCategories,
  seedOwners,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const DAY_MS = 24 * HOUR_MS;
const NOW = new Date();
const { a, b, c, d, e, f } = VIDEO_IDS;
const VIEWER: UserContext = { id: OWNER_ID, role: 'USER' };
const OTHER_VIEWER: UserContext = { id: OTHER_OWNER_ID, role: 'USER' };

const rules = (
  conditions: SmartPlaylistCondition[],
  extra: Partial<SmartPlaylistRules> = {}
): SmartPlaylistRules => ({ match: 'all', conditions, sort: 'newest', limit: 200, ...extra });

/**
 * c and d on the other owner's channel, the rest on the owner's; e is a Short and f is private. Each
 * is a day older than the one before it, so `newest` reads a, b, c, d, e.
 */
async function seedLibrary(subject: RepositoriesSubject): Promise<void> {
  const videos = [
    { id: a, channelId: OWNER_CHANNEL_ID, durationMs: 300_000, tags: ['jazz'], viewsCount: 5 },
    { id: b, channelId: OWNER_CHANNEL_ID, durationMs: 900_000, tags: ['rock'], viewsCount: 50 },
    {
      id: c,
      ownerId: OTHER_OWNER_ID,
      channelId: OTHER_OWNER_CHANNEL_ID,
      durationMs: 120_000,
      categoryId: CATEGORY_MUSIC_ID,
      viewsCount: 20,
    },
    {
      id: d,
      ownerId: OTHER_OWNER_ID,
      channelId: OTHER_OWNER_CHANNEL_ID,
      durationMs: 2_400_000,
      viewsCount: 1,
    },
    { id: e, format: 'short' as const, durationMs: 30_000, viewsCount: 9 },
    { id: f, visibility: 'private' as const, durationMs: 60_000 },
  ];
  for (const [index, video] of videos.entries()) {
    await subject.seedVideo(publicVideo(video), new Date(NOW.getTime() - (index + 1) * DAY_MS));
  }
}

export function describeSmartPlaylistContract(makeSubject: MakeRepositoriesSubject): void {
  describe('SmartPlaylistRepository contract', () => {
    let subject: RepositoriesSubject;

    const evaluate = async (
      given: SmartPlaylistRules,
      viewer: UserContext | null = VIEWER,
      options: { cursor?: { key: number; id: string } | null; limit?: number; now?: Date } = {}
    ) =>
      expectOk(
        await subject.repositories.smartPlaylists.evaluate(given, viewer, {
          cursor: options.cursor ?? null,
          limit: options.limit ?? 50,
          now: options.now ?? NOW,
        })
      );
    const idsOf = async (...args: Parameters<typeof evaluate>) =>
      (await evaluate(...args)).map((entry) => entry.video.id);
    const watch = (userId: string, videoId: string, progressSeconds: number) =>
      subject.repositories.watchHistory.record({
        id: `00000000-0000-7000-8000-0000000071${videoId.slice(-1)}${userId.slice(-1)}`,
        userId,
        videoId,
        progressSeconds,
        durationSeconds: 100,
        watchedAt: NOW,
      });

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await seedCategories(subject.repositories);
      await seedLibrary(subject);
    });

    it.each<{ scenario: string; conditions: SmartPlaylistCondition[]; expected: string[] }>([
      { scenario: 'no condition: the public feed', conditions: [], expected: [a, b, c, d, e] },
      {
        scenario: 'a channel',
        conditions: [{ field: 'channel', channelIds: [OTHER_OWNER_CHANNEL_ID] }],
        expected: [c, d],
      },
      { scenario: 'a tag', conditions: [{ field: 'tag', tags: ['jazz', 'blues'] }], expected: [a] },
      {
        scenario: 'a category',
        conditions: [{ field: 'category', categoryId: CATEGORY_MUSIC_ID }],
        expected: [c],
      },
      {
        scenario: 'under ten minutes',
        conditions: [{ field: 'duration', duration: { op: 'under', seconds: 600 } }],
        expected: [a, c, e],
      },
      {
        scenario: 'over ten minutes',
        conditions: [{ field: 'duration', duration: { op: 'over', seconds: 600 } }],
        expected: [b, d],
      },
      {
        scenario: 'between two and fifteen minutes',
        conditions: [
          { field: 'duration', duration: { op: 'between', minSeconds: 120, maxSeconds: 900 } },
        ],
        expected: [a, b, c],
      },
      { scenario: 'Shorts', conditions: [{ field: 'format', format: 'short' }], expected: [e] },
      {
        scenario: 'long videos',
        conditions: [{ field: 'format', format: 'long' }],
        expected: [a, b, c, d],
      },
      {
        scenario: 'newer than two and a half days',
        conditions: [{ field: 'newer_than', days: 2.5 }],
        expected: [a, b],
      },
    ])('matches $scenario', async ({ conditions, expected }) => {
      expect(await idsOf(rules(conditions))).toEqual(expected);
    });

    it('answers channel A or B, under ten minutes, unwatched and newer than 30 days for two viewers apart', async () => {
      expectOk(await watch(OWNER_ID, a, 95));
      expectOk(await watch(OWNER_ID, c, 50));
      expectOk(await watch(OTHER_OWNER_ID, c, 92));
      const smart = rules([
        { field: 'channel', channelIds: [OWNER_CHANNEL_ID, OTHER_OWNER_CHANNEL_ID] },
        { field: 'duration', duration: { op: 'under', seconds: 600 } },
        { field: 'unwatched' },
        { field: 'newer_than', days: 30 },
      ]);

      expect([
        await idsOf(smart, VIEWER),
        await idsOf(smart, OTHER_VIEWER),
        await idsOf(smart, null),
      ]).toEqual([
        [c, e],
        [a, e],
        [a, c, e],
      ]);
    });

    it('matches any condition under any, a guest matching every unwatched one', async () => {
      const smart = rules(
        [
          { field: 'format', format: 'short' },
          { field: 'tag', tags: ['rock'] },
        ],
        { match: 'any' }
      );

      expect([
        await idsOf(smart),
        await idsOf(
          rules([{ field: 'tag', tags: ['rock'] }, { field: 'unwatched' }], { match: 'any' }),
          null
        ),
      ]).toEqual([
        [b, e],
        [a, b, c, d, e],
      ]);
    });

    it('counts newer_than back from the instant it is given', async () => {
      const later = new Date(NOW.getTime() + 30 * DAY_MS);

      expect(
        await idsOf(rules([{ field: 'newer_than', days: 30 }]), VIEWER, { now: later })
      ).toEqual([]);
    });

    it.each([
      { sort: 'oldest' as const, expected: [e, d, c, b, a] },
      { sort: 'popular' as const, expected: [b, c, e, a, d] },
      { sort: 'shortest' as const, expected: [e, c, a, b, d] },
      { sort: 'longest' as const, expected: [d, b, a, c, e] },
    ])('sorts by $sort', async ({ sort, expected }) => {
      expect(await idsOf(rules([], { sort }))).toEqual(expected);
    });

    it('stops at the limit and pages within it on the sort key', async () => {
      const smart = rules([], { sort: 'popular', limit: 4 });
      const first = await evaluate(smart, VIEWER, { limit: 2 });
      const last = first[1];
      if (!last) throw new Error('the first page holds two videos');
      const second = await evaluate(smart, VIEWER, {
        limit: 2,
        cursor: { key: last.key, id: last.video.id },
      });

      expect([first.map((entry) => entry.video.id), second.map((entry) => entry.video.id)]).toEqual(
        [
          [b, c, e],
          [e, a],
        ]
      );
      expect(first.map((entry) => entry.key)).toEqual([50, 20, 9]);
      expect(second.map((entry) => entry.position)).toEqual([2, 3]);
    });

    it('hands each video its channel', async () => {
      const [first] = await evaluate(rules([{ field: 'tag', tags: ['jazz'] }]));

      expect(first?.channel).toMatchObject({ id: OWNER_CHANNEL_ID, handle: 'owner' });
    });
  });
}
