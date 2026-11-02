import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { databaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { err, ok } from '@vp/result';
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
      subscriptions: repositories.subscriptions,
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
        retention: [],
        hourly: [
          { videoId: VIDEO, viewHour: '2026-03-10T07:00:00.000Z', views: 2 },
          { videoId: OTHER_VIDEO, viewHour: '2026-03-10T07:00:00.000Z', views: 5 },
          { videoId: VIDEO, viewHour: '2026-03-08T08:00:00.000Z', views: 9 },
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
        rangeWatchSeconds: 180,
        totalViews: 57,
        averageDailyViews: 1,
        previous: { rangeViews: 50, rangeWatchSeconds: 1_500 },
      });
      expect(analytics.timeline).toHaveLength(7);
      expect(analytics.timeline.at(-1)).toEqual({
        viewDate: '2026-03-10',
        views: 3,
        watchSeconds: 60,
      });
      expect(analytics.averageRetention).toBeCloseTo(180 / (7 * 60));
    });

    it.each([
      { range: '30d', days: 30, from: '2026-02-09' },
      { range: 'lifetime', days: 10, from: '2026-03-01' },
    ] as const)('widens the timeline to $range', async ({ range, days, from }) => {
      const analytics = expectOk(await service.videoAnalytics(OWNER, VIDEO, range));

      expect(analytics).toMatchObject({ from, rangeViews: 57, averageDailyViews: 57 / days });
      expect(analytics.timeline).toHaveLength(days);
    });

    it('has no previous period over its lifetime', async () => {
      expect(expectOk(await service.videoAnalytics(OWNER, VIDEO, 'lifetime')).previous).toBeNull();
    });

    it('reads the last 48 hours of the video, zero-filled, whatever the range', async () => {
      const { hourly } = expectOk(await service.videoAnalytics(OWNER, VIDEO, '90d'));

      expect(hourly).toHaveLength(48);
      expect(hourly[0]).toEqual({ viewHour: '2026-03-08T09:00:00.000Z', views: 0 });
      expect(hourly.at(-2)).toEqual({ viewHour: '2026-03-10T07:00:00.000Z', views: 2 });
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

    it.each(['videoTimeline', 'videoHourly'] as const)(
      'reports a database that fails %s',
      async (method) => {
        vi.spyOn(repositories.videoViews, method).mockResolvedValueOnce(
          err(databaseUnavailable(method))
        );

        expect(expectErr(await service.videoAnalytics(OWNER, VIDEO, '7d')).code).toBe(
          'DATABASE_UNAVAILABLE'
        );
      }
    );
  });

  describe('videoRetention', () => {
    it('fills the curve from the steps viewers reached', async () => {
      expectOk(
        await repositories.videoViews.applyBatch({
          batchId: 'retention',
          counts: [],
          retention: [
            { videoId: VIDEO, percent: 0, viewers: 10 },
            { videoId: VIDEO, percent: 50, viewers: 4 },
          ],
          hourly: [],
        })
      );

      const { curve } = expectOk(await service.videoRetention(OWNER, VIDEO));

      expect(curve).toHaveLength(21);
      expect(curve.filter(({ viewers }) => viewers > 0)).toEqual([
        { percent: 0, viewers: 10 },
        { percent: 50, viewers: 4 },
      ]);
    });

    it.each([
      { scenario: 'a stranger on a public video', videoId: VIDEO, code: 'FORBIDDEN' },
      {
        scenario: 'an absent video',
        videoId: '00000000-0000-7000-8000-0000000000ff',
        code: 'VIDEO_NOT_FOUND',
      },
    ])('refuses $scenario with $code', async ({ videoId, code }) => {
      expect(expectErr(await service.videoRetention(STRANGER, videoId)).code).toBe(code);
    });
  });

  describe('channelAnalytics', () => {
    it("sums the caller's videos over the range and ranks them", async () => {
      const analytics = expectOk(await service.channelAnalytics(OWNER, '7d'));

      expect(analytics).toMatchObject({
        range: '7d',
        rangeViews: 14,
        rangeWatchSeconds: 390,
        totalViews: 64,
        videoCount: 2,
        dailyVelocity: 2,
        previous: { rangeViews: 50, rangeWatchSeconds: 1_500, netSubscribers: 0 },
      });
      expect(analytics.timeline).toHaveLength(7);
      expect(analytics.topVideos.map((video) => [video.videoId, video.views])).toEqual([
        [VIDEO, 7],
        [OTHER_VIDEO, 7],
      ]);
    });

    it("sums the hours of the caller's videos over the last 48", async () => {
      const { hourly } = expectOk(await service.channelAnalytics(OWNER, '7d'));

      expect(hourly).toHaveLength(48);
      expect(hourly.at(-2)).toEqual({ viewHour: '2026-03-10T07:00:00.000Z', views: 7 });
    });

    it('nets the subscribers of the range and of the period before it', async () => {
      const netSubscribers = vi
        .spyOn(repositories.subscriptions, 'netSubscribers')
        .mockResolvedValueOnce(ok(3))
        .mockResolvedValueOnce(ok(-1));

      const analytics = expectOk(await service.channelAnalytics(OWNER, '7d'));

      expect(analytics.netSubscribers).toBe(3);
      expect(analytics.previous?.netSubscribers).toBe(-1);
      expect(netSubscribers.mock.calls).toEqual([
        [OWNER.id, { from: '2026-03-04', to: '2026-03-10' }],
        [OWNER.id, { from: '2026-02-25', to: '2026-03-03' }],
      ]);
    });

    it('reads a lifetime from the first day with views, with no previous period', async () => {
      const analytics = expectOk(await service.channelAnalytics(OWNER, 'lifetime'));

      expect(analytics).toMatchObject({
        from: '2026-03-01',
        rangeViews: 64,
        dailyVelocity: 6.4,
        previous: null,
      });
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

    it.each(['channelTimeline', 'channelTotals', 'topVideos', 'channelHourly'] as const)(
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

    it('reports a database that fails netSubscribers', async () => {
      vi.spyOn(repositories.subscriptions, 'netSubscribers').mockResolvedValueOnce(
        err(databaseUnavailable('netSubscribers'))
      );

      expect(expectErr(await service.channelAnalytics(OWNER, '7d')).code).toBe(
        'DATABASE_UNAVAILABLE'
      );
    });
  });
});
