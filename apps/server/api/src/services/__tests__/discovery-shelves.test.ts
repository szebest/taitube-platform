import {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemorySearchSuggestionIndex,
} from '@vp/adapters/in-memory';
import { Singleflight } from '@vp/concurrency';
import { RISING, SEARCH_SUGGESTIONS } from '@vp/domain';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { DiscoveryShelves } from '../discovery-shelves';
import { HistoryPause } from '../history-pause';
import { SearchService } from '../search-service';
import { VideoService } from '../video-service';
import { ViewerProgress } from '../viewer-progress';
import { TEST_CDN, TEST_SPRITE, videoServiceDeps } from './service-deps';

const VIEWER: UserContext = { id: '00000000-0000-7000-8000-0000000000a1', role: 'USER' };
const OTHER: UserContext = { id: '00000000-0000-7000-8000-0000000000a3', role: 'USER' };
const CREATOR = '00000000-0000-7000-8000-0000000000a2';
const NIGHT = '00000000-0000-7000-8000-0000000000c1';
const FOOD = '00000000-0000-7000-8000-0000000000c3';
const CLIP = '00000000-0000-7000-8000-0000000000c4';
const SEARCH_ROW = '00000000-0000-7000-8000-0000000009e1';
const HOUR = 3_600_000;

describe('apps/server/api/services: DiscoveryShelves', () => {
  let repositories: InMemoryRepositories;
  let creatorChannelId: string;
  let shelves: DiscoveryShelves;

  const publish = (id: string, ownerId = CREATOR) =>
    repositories.videos.create({
      id,
      ownerId,
      title: `Video ${id.slice(-2)}`,
      visibility: 'public',
      status: 'READY',
      sourceKey: `raw/${id}.mp4`,
    });

  const searched = (hoursAgo: number, userId = VIEWER.id) =>
    repositories.searchHistory.record({
      id: SEARCH_ROW,
      userId,
      query: 'Video',
      queryKey: 'video',
      searchedAt: new Date(Date.now() - hoursAgo * HOUR),
    });

  const watch = (videoId: string) =>
    repositories.watchHistory.record({
      id: '00000000-0000-7000-8000-000000000701',
      userId: VIEWER.id,
      videoId,
      progressSeconds: 5,
      durationSeconds: 100,
      watchedAt: new Date(),
    });

  const retain = (sessions: number, completed: number) =>
    repositories.videoViews.applyBatch({
      batchId: `retention-${sessions}-${completed}`,
      counts: [],
      retention: [
        { videoId: CLIP, percent: RISING.startPercent, viewers: sessions },
        { videoId: CLIP, percent: RISING.completedPercent, viewers: completed },
      ],
    });

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    const viewerProgress = new ViewerProgress(repositories.watchHistory);
    const videoService = new VideoService(
      videoServiceDeps(repositories.videos, { channels: repositories.channels })
    );
    shelves = new DiscoveryShelves({
      searchHistory: repositories.searchHistory,
      search: new SearchService({
        search: repositories.search,
        suggestions: new InMemorySearchSuggestionIndex(Date.now, SEARCH_SUGGESTIONS.keptPerPrefix),
        cache: new InMemoryCacheClient(),
        singleflight: new Singleflight(),
        paginator: new Paginator(),
        viewerProgress,
        history: repositories.searchHistory,
        pause: new HistoryPause(repositories.userPreferences),
        cdn: TEST_CDN,
        sprite: TEST_SPRITE,
        channels: repositories.channels,
        now: Date.now,
      }),
      rising: repositories.rising,
      videoService,
      now: Date.now,
    });
    creatorChannelId = expectOk(
      await repositories.channels.create({
        userId: CREATOR,
        handle: 'creator',
        displayName: 'Creator',
      })
    ).id;
    await publish(NIGHT);
    await publish(FOOD);
    await publish(CLIP);
  });

  describe('becauseSearched', () => {
    const shelfFor = async (viewer: UserContext | null) =>
      expectOk(await shelves.becauseSearched(viewer))[0];

    it('lists the results of the latest search the viewer has not watched, each with its reason', async () => {
      await searched(1);
      await watch(NIGHT);

      const shelf = await shelfFor(VIEWER);

      expect(shelf?.subject).toEqual({ kind: 'query', id: SEARCH_ROW, name: 'Video' });
      expect(shelf?.items.map(({ id }) => id).sort()).toEqual([CLIP, FOOD].sort());
      expect(shelf?.items.map(({ reason }) => reason)).toEqual(
        Array(2).fill({ kind: 'searched', subjectId: SEARCH_ROW })
      );
    });

    it.each([
      { scenario: 'a search three days old', hoursAgo: 72, viewer: VIEWER },
      { scenario: 'a search just inside the window', hoursAgo: 47, viewer: VIEWER, shown: true },
      { scenario: 'a search just outside the window', hoursAgo: 49, viewer: VIEWER },
      { scenario: 'a visitor', hoursAgo: 1, viewer: null },
      { scenario: 'the search of another viewer', hoursAgo: 1, viewer: OTHER },
    ])('shows $scenario a shelf: $shown', async ({ hoursAgo, viewer, shown = false }) => {
      await searched(hoursAgo);

      expect(Boolean(await shelfFor(viewer))).toBe(shown);
    });

    it('writes no history row of its own', async () => {
      await searched(1);

      await shelves.becauseSearched(VIEWER);

      expect(
        expectOk(await repositories.searchHistory.list(VIEWER.id, { cursor: null, limit: 10 }))
      ).toHaveLength(1);
    });
  });

  describe('rising', () => {
    const shelfFor = async (viewer: UserContext | null, history = []) =>
      expectOk(await shelves.rising(viewer, history))[0];

    it.each([
      { who: 'a signed-in viewer', viewer: VIEWER },
      { who: 'a visitor', viewer: null },
    ])(
      'shows $who the video of a small channel, with the channel as the reason',
      async ({ viewer }) => {
        await retain(RISING.minSessions, 10);

        const shelf = await shelfFor(viewer);

        expect(shelf?.items.map(({ id, reason }) => [id, reason.kind])).toEqual([[CLIP, 'rising']]);
        expect(shelf?.items[0]?.reason.subjectId).toBe(creatorChannelId);
      }
    );

    it('shows nothing below the session floor', async () => {
      await retain(RISING.minSessions - 1, 10);

      expect((await shelfFor(null))?.items).toEqual([]);
    });

    it('leaves out a video in the watch window of the viewer', async () => {
      await retain(RISING.minSessions, 10);
      await watch(CLIP);
      const history = expectOk(
        await repositories.watchHistory.list(VIEWER, { cursor: null, limit: 10 })
      );

      expect((await shelfFor(VIEWER, history as never))?.items).toEqual([]);
    });

    it('leaves out the viewer own uploads', async () => {
      await retain(RISING.minSessions, 10);

      expect((await shelfFor({ id: CREATOR, role: 'CREATOR' }))?.items).toEqual([]);
    });
  });
});
