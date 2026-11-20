import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { DeviceViewCount, ViewCount } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { SEEDED } from '@vp/testing-fixtures';
import { AnalyticsService } from '../analytics-service';

const OWNER: UserContext = { id: SEEDED.userId, role: 'CREATOR' };
const STRANGER: UserContext = { id: SEEDED.otherUserId, role: 'USER' };
const VIDEO = '00000000-0000-7000-8000-0000000000a1';
const ABSENT = '00000000-0000-7000-8000-0000000000ff';
const NOW = Date.parse('2026-03-20T08:00:00.000Z');
const DAY_MS = 86_400_000;

describe('AnalyticsService: audience and benchmark', () => {
  let repositories: InMemoryRepositories;
  let service: AnalyticsService;
  let now: number;

  const seed = async (id: string, readyAt: Date | null, overrides = {}) =>
    expectOk(
      await repositories.videos.create({
        id,
        ownerId: OWNER.id,
        channelId: SEEDED.channelId,
        visibility: 'public',
        status: 'READY',
        sourceKey: `raw/${id}/source.mp4`,
        readyAt,
        ...overrides,
      })
    );

  const apply = async (counts: ViewCount[], devices: DeviceViewCount[] = []) =>
    expectOk(
      await repositories.videoViews.applyBatch({
        batchId: crypto.randomUUID(),
        counts,
        retention: [],
        hourly: [],
        devices,
      })
    );

  const daily = (videoId: string, viewDate: string, views: number): ViewCount => ({
    videoId,
    viewDate,
    views,
    watchSeconds: 0,
  });

  const peerId = (n: number) => `00000000-0000-7000-8000-0000000001${String(n).padStart(2, '0')}`;

  const seedPeers = async (count: number) => {
    for (let n = 1; n <= count; n++) {
      const readyAt = new Date(Date.parse('2026-03-01T10:00:00.000Z') + n * DAY_MS);
      await seed(peerId(n), readyAt);
      await apply([daily(peerId(n), readyAt.toISOString().slice(0, 10), n * 10)]);
    }
  };

  beforeEach(() => {
    now = NOW;
    repositories = new InMemoryRepositories();
    service = new AnalyticsService({
      videos: repositories.videos,
      videoViews: repositories.videoViews,
      subscriptions: repositories.subscriptions,
      now: () => now,
    });
  });

  describe('videoAudience', () => {
    beforeEach(async () => {
      await seed(VIDEO, new Date('2026-02-01T00:00:00.000Z'));
    });

    it('splits the range views by device, most viewed first, with shares that sum to one', async () => {
      await apply(
        [],
        [
          { videoId: VIDEO, viewDate: '2026-03-19', device: 'desktop', views: 1 },
          { videoId: VIDEO, viewDate: '2026-03-18', device: 'mobile', views: 2 },
          { videoId: VIDEO, viewDate: '2026-03-20', device: 'mobile', views: 1 },
          { videoId: VIDEO, viewDate: '2026-03-01', device: 'tablet', views: 50 },
        ]
      );

      const audience = expectOk(await service.videoAudience(OWNER, VIDEO, '7d'));

      expect(audience).toEqual({
        videoId: VIDEO,
        range: '7d',
        from: '2026-03-14',
        to: '2026-03-20',
        devices: [
          { device: 'mobile', views: 3, share: 0.75 },
          { device: 'desktop', views: 1, share: 0.25 },
        ],
      });
    });

    it('widens the split with the range', async () => {
      await apply([], [{ videoId: VIDEO, viewDate: '2026-03-01', device: 'tablet', views: 5 }]);

      expect(expectOk(await service.videoAudience(OWNER, VIDEO, '7d')).devices).toEqual([]);
      expect(expectOk(await service.videoAudience(OWNER, VIDEO, '30d')).devices).toEqual([
        { device: 'tablet', views: 5, share: 1 },
      ]);
      expect(expectOk(await service.videoAudience(OWNER, VIDEO, 'lifetime')).devices).toEqual([
        { device: 'tablet', views: 5, share: 1 },
      ]);
    });

    it.each([
      {
        scenario: 'a stranger on a public video',
        videoId: VIDEO,
        viewer: STRANGER,
        code: ErrorCodes.FORBIDDEN,
      },
      {
        scenario: 'an absent video',
        videoId: ABSENT,
        viewer: OWNER,
        code: ErrorCodes.VIDEO_NOT_FOUND,
      },
    ])('refuses $scenario', async ({ videoId, viewer, code }) => {
      expect(expectErr(await service.videoAudience(viewer, videoId, '7d')).code).toBe(code);
    });
  });

  describe('videoBenchmark', () => {
    const benchmark = async () => expectOk(await service.videoBenchmark(OWNER, VIDEO));

    it('reads the cumulative first week of the video, null for the days not begun', async () => {
      await seed(VIDEO, new Date('2026-03-19T22:00:00.000Z'));
      await apply([daily(VIDEO, '2026-03-19', 4), daily(VIDEO, '2026-03-20', 3)]);

      const { days, publishedAt, peerCount } = await benchmark();

      expect(publishedAt).toBe('2026-03-19T22:00:00.000Z');
      expect(peerCount).toBe(0);
      expect(days.map(({ views }) => views)).toEqual([4, 7, null, null, null, null, null]);
      expect(
        days.every(({ p25, median, p75 }) => p25 === null && median === null && p75 === null)
      ).toBe(true);
    });

    it.each([[0], [2]])('has no envelope with %i earlier videos', async (peers) => {
      await seed(VIDEO, new Date('2026-03-19T22:00:00.000Z'));
      await seedPeers(peers);

      const result = await benchmark();

      expect(result.peerCount).toBe(peers);
      expect(result.days[0]).toMatchObject({ p25: null, median: null, p75: null });
    });

    it('takes the percentiles of the earlier videos once there are three', async () => {
      await seed(VIDEO, new Date('2026-03-19T22:00:00.000Z'));
      await seedPeers(3);

      const { days, peerCount } = await benchmark();

      expect(peerCount).toBe(3);
      expect(days[0]).toMatchObject({ p25: 15, median: 20, p75: 25 });
      expect(days[6]).toMatchObject({ p25: 15, median: 20, p75: 25 });
    });

    it('compares against the ten most recent peers at least seven days old, never the video itself', async () => {
      await seed(VIDEO, new Date('2026-03-01T00:00:00.000Z'));
      await seedPeers(12);
      await seed(peerId(50), new Date('2026-03-18T00:00:00.000Z'));

      expect((await benchmark()).peerCount).toBe(10);
    });

    it('answers an unfinished video with no views and no days begun', async () => {
      await seed(VIDEO, null, { status: 'PROCESSING' });

      const result = await benchmark();

      expect(result.publishedAt).toBeNull();
      expect(result.days.map(({ views }) => views)).toEqual(Array(7).fill(null));
    });

    it.each([
      {
        scenario: 'a stranger on a public video',
        videoId: VIDEO,
        viewer: STRANGER,
        code: ErrorCodes.FORBIDDEN,
      },
      {
        scenario: 'an absent video',
        videoId: ABSENT,
        viewer: OWNER,
        code: ErrorCodes.VIDEO_NOT_FOUND,
      },
    ])('refuses $scenario', async ({ videoId, viewer, code }) => {
      await seed(VIDEO, new Date('2026-03-19T22:00:00.000Z'));

      expect(expectErr(await service.videoBenchmark(viewer, videoId)).code).toBe(code);
    });
  });
});
