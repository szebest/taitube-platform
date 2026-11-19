import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { ChannelRole } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { SEEDED } from '@vp/testing-fixtures';
import { AnalyticsService } from '../analytics-service';

const OWNER: UserContext = { id: SEEDED.userId, role: 'CREATOR' };
const STRANGER: UserContext = { id: SEEDED.otherUserId, role: 'USER' };
const STRANGER_CHANNEL_ID = '00000000-0000-7000-8000-0000000000f9';
const VIDEO = '00000000-0000-7000-8000-0000000000a1';
const NOW = Date.parse('2026-03-10T08:00:00.000Z');
const READY_AT = new Date('2026-03-09T20:30:00.000Z');

const memberAs = (role: ChannelRole): UserContext => ({
  id: 'member-1',
  role: 'USER',
  memberships: { [SEEDED.channelId]: { role, ownerId: OWNER.id } },
});

describe('AnalyticsService: creatorStats', () => {
  let repositories: InMemoryRepositories;
  let service: AnalyticsService;
  let now: number;

  const statsAt = async (at: number) => {
    now = at;
    return expectOk(await service.creatorStats(OWNER, VIDEO));
  };

  beforeEach(async () => {
    now = NOW;
    repositories = new InMemoryRepositories();
    service = new AnalyticsService({
      videos: repositories.videos,
      videoViews: repositories.videoViews,
      subscriptions: repositories.subscriptions,
      now: () => now,
    });
    const video = expectOk(
      await repositories.videos.create({
        id: VIDEO,
        ownerId: OWNER.id,
        channelId: SEEDED.channelId,
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/a1/source.mp4',
        durationMs: 100_000,
        likesCount: 4,
        commentsCount: 2,
      })
    );
    video.readyAt = READY_AT;
    expectOk(
      await repositories.videoViews.applyBatch({
        batchId: 'seed',
        counts: [
          { videoId: VIDEO, viewDate: '2026-02-01', views: 6, watchSeconds: 120 },
          { videoId: VIDEO, viewDate: '2026-03-09', views: 3, watchSeconds: 90 },
          { videoId: VIDEO, viewDate: '2026-03-10', views: 1, watchSeconds: 30 },
        ],
        retention: [0, 5, 10, 15, 20].map((percent, step) => ({
          videoId: VIDEO,
          percent,
          viewers: [10, 10, 4, 4, 3][step] ?? 0,
        })),
        hourly: [
          { videoId: VIDEO, viewHour: '2026-03-09T21:00:00.000Z', views: 3 },
          { videoId: VIDEO, viewHour: '2026-03-10T07:00:00.000Z', views: 1 },
        ],
        devices: [],
      })
    );
    expectOk(
      await repositories.subscriptions.subscribe(
        OWNER.id,
        SEEDED.channelId,
        SEEDED.otherChannelId,
        VIDEO
      )
    );
  });

  it('reads the totals, the 30 day range and the retention in one answer', async () => {
    const stats = await statsAt(NOW);

    expect(stats).toMatchObject({
      videoId: VIDEO,
      generatedAt: '2026-03-10T08:00:00.000Z',
      lifetime: { watchSeconds: 240, likes: 4, comments: 2, subscribersGained: 1 },
      last30Days: { views: 4, watchSeconds: 120, averageViewDurationSeconds: 30 },
    });
    expect(stats.last30Days.daily).toHaveLength(30);
    expect(stats.last30Days.daily.at(-1)).toEqual({ date: '2026-03-10', views: 1 });
    expect(stats.retention.average).toBeCloseTo(240 / (10 * 100));
    expect(stats.retention.dropOffs[0]).toEqual({ percent: 5, positionSeconds: 5, lostShare: 0.6 });
  });

  it('fills the 48 hours from the hour the video became ready', async () => {
    const hours = (await statsAt(NOW)).first48Hours;

    expect(hours?.windowEndsAt).toBe('2026-03-11T20:30:00.000Z');
    expect(hours?.hours).toHaveLength(48);
    expect(hours?.hours[0]).toEqual({ hour: '2026-03-09T20:00:00.000Z', views: 0 });
    expect(hours?.hours[1]).toEqual({ hour: '2026-03-09T21:00:00.000Z', views: 3 });
  });

  it.each([
    ['just before the window closes', Date.parse('2026-03-11T20:29:59.000Z'), true],
    ['when it closes', Date.parse('2026-03-11T20:30:00.000Z'), false],
    ['long after', Date.parse('2026-04-30T00:00:00.000Z'), false],
  ])('answers the 48 hours %s: %s', async (_when, at, open) => {
    expect((await statsAt(at)).first48Hours !== null).toBe(open);
  });

  it('has no 48 hours for a video that is not ready', async () => {
    const video = expectOk(await repositories.videos.findById(VIDEO));
    if (video) video.readyAt = null;

    expect((await statsAt(NOW)).first48Hours).toBeNull();
  });

  it('counts the subscribers gained from the video net of those who left', async () => {
    const subscribe = expectOk(
      await repositories.subscriptions.subscribe(
        STRANGER.id,
        STRANGER_CHANNEL_ID,
        SEEDED.channelId,
        VIDEO
      )
    );
    expect(subscribe.changed).toBe(true);
    expect((await statsAt(NOW)).lifetime.subscribersGained).toBe(2);

    expectOk(await repositories.subscriptions.unsubscribe(STRANGER_CHANNEL_ID, SEEDED.channelId));

    expect((await statsAt(NOW)).lifetime.subscribersGained).toBe(1);
  });

  it('shows no drop-offs and no average for a video nobody watched', async () => {
    const other = '00000000-0000-7000-8000-0000000000a2';
    expectOk(
      await repositories.videos.create({
        id: other,
        ownerId: OWNER.id,
        channelId: SEEDED.channelId,
        sourceKey: 'raw/a2/source.mp4',
        durationMs: 100_000,
      })
    );

    expect(expectOk(await service.creatorStats(OWNER, other)).retention).toEqual({
      average: null,
      dropOffs: [],
    });
  });

  it.each([
    ['the owner', OWNER, true],
    ['a manager', memberAs('manager'), true],
    ['an editor', memberAs('editor'), true],
    ['an analytics viewer', memberAs('analytics'), true],
    ['a moderator', memberAs('moderator'), false],
    ['a stranger', STRANGER, false],
  ])('answers %s: %s', async (_who, viewer, allowed) => {
    const result = await service.creatorStats(viewer, VIDEO);

    if (allowed) expectOk(result);
    else expect(expectErr(result).code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('answers a video that is not there as not found', async () => {
    const absent = '00000000-0000-7000-8000-0000000000ff';

    expect(expectErr(await service.creatorStats(OWNER, absent)).code).toBe(
      ErrorCodes.VIDEO_NOT_FOUND
    );
  });
});
