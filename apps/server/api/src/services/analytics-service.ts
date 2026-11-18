import { type Result, isErr, ok } from '@kit/result';
import type {
  ChannelAnalytics,
  CreatorStats,
  VideoAnalytics,
  VideoRetention,
} from '@vp/api-contracts';
import type {
  SubscriptionRepositoryPort,
  VideoRepository,
  VideoViewRepositoryPort,
} from '@vp/core/repositories';
import {
  type ActingChannel,
  type AnalyticsRange,
  TOP_VIDEOS_LIMIT,
  analyticsPeriods,
  averageRetention,
  averageViewDurationSeconds,
  fillHourly,
  fillRetentionCurve,
  firstHoursWindow,
  hourlyWindow,
  periodsSpan,
  sumViews,
  summarizeViews,
} from '@vp/domain';
import {
  type AuthorizationFailure,
  type ReadVideoFailure,
  decideChannelTask,
  decideVideoAnalyticsRead,
  decideVideoStatsRead,
  dropOffMoments,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';

export interface AnalyticsServiceDeps {
  videos: VideoRepository;
  videoViews: VideoViewRepositoryPort;
  subscriptions: SubscriptionRepositoryPort;
  now: () => number;
}

export type VideoAnalyticsFailure = ReadVideoFailure | DatabaseUnavailable;
export type ChannelAnalyticsFailure = AuthorizationFailure | DatabaseUnavailable;

/** Reads what the view flush has committed; views still in the buffer arrive with the next flush. */
export class AnalyticsService {
  constructor(private readonly deps: AnalyticsServiceDeps) {}

  async videoAnalytics(
    viewer: UserContext,
    videoId: string,
    range: AnalyticsRange
  ): Promise<Result<VideoAnalytics, VideoAnalyticsFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;
    const allowed = decideVideoAnalyticsRead({ viewer, video: found.value, videoId });
    if (isErr(allowed)) return allowed;
    const video = allowed.value;

    const now = new Date(this.deps.now());
    const periods = analyticsPeriods(range, now);
    const rows = await this.deps.videoViews.videoTimeline(videoId, periodsSpan(periods));
    if (isErr(rows)) return rows;
    const hours = hourlyWindow(now);
    const hourly = await this.deps.videoViews.videoHourly(videoId, hours);
    if (isErr(hourly)) return hourly;

    const { previous, ...summary } = summarizeViews(periods, rows.value);
    const totals = sumViews(summary.timeline);
    return ok({
      videoId,
      range,
      ...summary,
      hourly: fillHourly(hours, hourly.value),
      rangeViews: totals.views,
      rangeWatchSeconds: totals.watchSeconds,
      totalViews: video.viewsCount ?? 0,
      averageDailyViews: totals.views / summary.timeline.length,
      averageRetention: averageRetention(totals, video.durationMs),
      previous: previous && {
        rangeViews: previous.views,
        rangeWatchSeconds: previous.watchSeconds,
      },
    });
  }

  /** The watch page's numbers in one read: the same functions as the studio's analytics, so the two agree. */
  async creatorStats(
    viewer: UserContext,
    videoId: string
  ): Promise<Result<CreatorStats, VideoAnalyticsFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;
    const allowed = decideVideoStatsRead({ viewer, video: found.value, videoId });
    if (isErr(allowed)) return allowed;
    const video = allowed.value;

    const now = new Date(this.deps.now());
    const lifetime = analyticsPeriods('lifetime', now);
    const rows = await this.deps.videoViews.videoTimeline(videoId, lifetime.current);
    if (isErr(rows)) return rows;
    const window = video.readyAt ? firstHoursWindow(video.readyAt) : null;
    const open = window !== null && now.toISOString() < window.endsAt;
    const hourly =
      window && open ? await this.deps.videoViews.videoHourly(videoId, window.range) : ok([]);
    if (isErr(hourly)) return hourly;
    const points = await this.deps.videoViews.retentionCurve(videoId);
    if (isErr(points)) return points;
    const gained = await this.deps.subscriptions.countFromVideo(videoId);
    if (isErr(gained)) return gained;

    const lifetimeTotals = sumViews(rows.value);
    const recent = summarizeViews(analyticsPeriods('30d', now), rows.value).timeline;
    const recentTotals = sumViews(recent);
    return ok({
      videoId,
      generatedAt: now.toISOString(),
      lifetime: {
        views: video.viewsCount ?? 0,
        watchSeconds: lifetimeTotals.watchSeconds,
        likes: video.likesCount ?? 0,
        comments: video.commentsCount ?? 0,
        subscribersGained: gained.value,
      },
      last30Days: {
        ...recentTotals,
        averageViewDurationSeconds: averageViewDurationSeconds(recentTotals),
        daily: recent.map(({ viewDate, views }) => ({ date: viewDate, views })),
      },
      first48Hours:
        window && open
          ? {
              hours: fillHourly(window.range, hourly.value).map(({ viewHour, views }) => ({
                hour: viewHour,
                views,
              })),
              windowEndsAt: window.endsAt,
            }
          : null,
      retention: {
        average: averageRetention(lifetimeTotals, video.durationMs),
        dropOffs: dropOffMoments(fillRetentionCurve(points.value), (video.durationMs ?? 0) / 1000),
      },
    });
  }

  async videoRetention(
    viewer: UserContext,
    videoId: string
  ): Promise<Result<VideoRetention, VideoAnalyticsFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;
    const allowed = decideVideoAnalyticsRead({ viewer, video: found.value, videoId });
    if (isErr(allowed)) return allowed;

    const points = await this.deps.videoViews.retentionCurve(videoId);
    if (isErr(points)) return points;
    return ok({ videoId, curve: fillRetentionCurve(points.value) });
  }

  async channelAnalytics(
    viewer: UserContext,
    acting: ActingChannel,
    range: AnalyticsRange
  ): Promise<Result<ChannelAnalytics, ChannelAnalyticsFailure>> {
    const allowed = decideChannelTask({ user: viewer, acting, task: 'read-analytics' });
    if (isErr(allowed)) return allowed;
    const { channelId } = allowed.value;

    const now = new Date(this.deps.now());
    const periods = analyticsPeriods(range, now);
    const rows = await this.deps.videoViews.channelTimeline(channelId, periodsSpan(periods));
    if (isErr(rows)) return rows;
    const totals = await this.deps.videoViews.channelTotals(channelId);
    if (isErr(totals)) return totals;
    const topVideos = await this.deps.videoViews.topVideos(
      channelId,
      periods.current,
      TOP_VIDEOS_LIMIT
    );
    if (isErr(topVideos)) return topVideos;
    const hours = hourlyWindow(now);
    const hourly = await this.deps.videoViews.channelHourly(channelId, hours);
    if (isErr(hourly)) return hourly;
    const netSubscribers = await this.deps.subscriptions.netSubscribers(channelId, periods.current);
    if (isErr(netSubscribers)) return netSubscribers;
    const previousSubscribers = periods.previous
      ? await this.deps.subscriptions.netSubscribers(channelId, periods.previous)
      : ok(null);
    if (isErr(previousSubscribers)) return previousSubscribers;

    const { previous, ...summary } = summarizeViews(periods, rows.value);
    const current = sumViews(summary.timeline);
    return ok({
      range,
      ...summary,
      hourly: fillHourly(hours, hourly.value),
      rangeViews: current.views,
      rangeWatchSeconds: current.watchSeconds,
      netSubscribers: netSubscribers.value,
      ...totals.value,
      dailyVelocity: current.views / summary.timeline.length,
      topVideos: topVideos.value,
      previous: previous && {
        rangeViews: previous.views,
        rangeWatchSeconds: previous.watchSeconds,
        netSubscribers: previousSubscribers.value ?? 0,
      },
    });
  }
}
