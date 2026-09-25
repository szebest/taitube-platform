import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { databaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { err } from '@vp/result';
import { SEEDED } from '@vp/testing';
import { expectErr, expectOk } from '@vp/testing/result';
import { AnalyticsService } from '../analytics-service';

const OWNER: UserContext = { id: SEEDED.userId, role: 'CREATOR' };
const STRANGER: UserContext = { id: SEEDED.otherUserId, role: 'USER' };
const VIDEO = '00000000-0000-7000-8000-0000000000a1';
const OTHER_VIDEO = '00000000-0000-7000-8000-0000000000a2';
const TODAY = Date.parse('2026-03-10T08:00:00.000Z');

describe('AnalyticsService', () => {
  let repositories: InMemoryRepositories;
  let service: AnalyticsService;

  const seed = async (id: string, overrides: { ownerId?: string; visibility?: 'private' } = {}) =>
    expectOk(
      await repositories.videos.create({
        id,
        ownerId: OWNER.id,
        title: `Video ${id.slice(-2)}`,
        visibility: 'public',
        status: 'READY',
        sourceKey: `raw/${id}/source.mp4`,
        durationMs: 60_000,
        ...overrides,
      })
    );

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    service = new AnalyticsService({
      videos: repositories.videos,
      videoViews: repositories.videoViews,
      now: () => TODAY,
    });
    await seed(VIDEO);
    await seed(OTHER_VIDEO);
    expectOk(
      await repositories.videoViews.applyBatch({
        batchId: 'seed',
        counts: [
          { videoId: VIDEO, viewDate: '2026-03-01', views: 50, watchSeconds: 1_500 },
          { videoId: VIDEO, viewDate: '2026-03-08', views: 4, watchSeconds: 120 },
          { videoId: VIDEO, viewDate: '2026-03-10', views: 3, watchSeconds: 60 },
          { videoId: OTHER_VIDEO, viewDate: '2026-03-09', views: 7, watchSeconds: 210 },
        ],
      })
    );
  });

  describe('videoAnalytics', () => {
    it('reads the range as a zero-filled timeline with its summary', async () => {
      const analytics = expectOk(await service.videoAnalytics(OWNER, VIDEO, '7d'));

      expect(analytics).toMatchObject({
        videoId: VIDEO,
        range: '7d',
        from: '2026-03-04',
        to: '2026-03-10',
        rangeViews: 7,
        totalViews: 57,
        averageDailyViews: 1,
      });
      expect(analytics.timeline).toHaveLength(7);
      expect(analytics.timeline.at(-1)).toEqual({
        viewDate: '2026-03-10',
        views: 3,
        watchSeconds: 60,
      });
      expect(analytics.averageRetention).toBeCloseTo(180 / (7 * 60));
    });

    it('widens the timeline with the range', async () => {
      const analytics = expectOk(await service.videoAnalytics(OWNER, VIDEO, '30d'));

      expect(analytics.timeline).toHaveLength(30);
      expect(analytics.rangeViews).toBe(57);
    });

    it.each([
      { scenario: 'a stranger on a public video', videoId: VIDEO, code: 'FORBIDDEN' },
      {
        scenario: 'an absent video',
        videoId: '00000000-0000-7000-8000-0000000000ff',
        code: 'VIDEO_NOT_FOUND',
      },
    ])('refuses $scenario with $code', async ({ videoId, code }) => {
      expect(expectErr(await service.videoAnalytics(STRANGER, videoId, '7d')).code).toBe(code);
    });

    it('reports a database it cannot read', async () => {
      vi.spyOn(repositories.videoViews, 'videoTimeline').mockResolvedValueOnce(
        err(databaseUnavailable('videoTimeline'))
      );

      expect(expectErr(await service.videoAnalytics(OWNER, VIDEO, '7d')).code).toBe(
        'DATABASE_UNAVAILABLE'
      );
    });
  });

  describe('channelAnalytics', () => {
    it("sums the caller's videos over the range and ranks them", async () => {
      const analytics = expectOk(await service.channelAnalytics(OWNER, '7d'));

      expect(analytics).toMatchObject({
        range: '7d',
        rangeViews: 14,
        totalViews: 64,
        videoCount: 2,
        dailyVelocity: 2,
      });
      expect(analytics.timeline).toHaveLength(7);
      expect(analytics.topVideos.map((video) => [video.videoId, video.views])).toEqual([
        [VIDEO, 7],
        [OTHER_VIDEO, 7],
      ]);
    });

    it('answers a channel with no views with zeros', async () => {
      const analytics = expectOk(await service.channelAnalytics(STRANGER, '7d'));

      expect(analytics).toMatchObject({
        rangeViews: 0,
        totalViews: 0,
        videoCount: 0,
        topVideos: [],
      });
    });

    it('refuses a guest-role caller', async () => {
      expect(
        expectErr(await service.channelAnalytics({ id: 'guest', role: 'GUEST' }, '7d')).code
      ).toBe('FORBIDDEN');
    });

    it.each(['channelTimeline', 'channelTotals', 'topVideos'] as const)(
      'reports a database that fails %s',
      async (method) => {
        vi.spyOn(repositories.videoViews, method).mockResolvedValueOnce(
          err(databaseUnavailable(method))
        );

        expect(expectErr(await service.channelAnalytics(OWNER, '7d')).code).toBe(
          'DATABASE_UNAVAILABLE'
        );
      }
    );
  });
});
