import type { ChannelAnalytics, VideoAnalytics, VideoRetention } from '@vp/api-contracts';
import type {
  SubscriptionRepositoryPort,
  VideoRepository,
  VideoViewRepositoryPort,
} from '@vp/core/repositories';
import {
  type AnalyticsRange,
  TOP_VIDEOS_LIMIT,
  analyticsPeriods,
  averageRetention,
  fillHourly,
  fillRetentionCurve,
  hourlyWindow,
  periodsSpan,
  sumViews,
  summarizeViews,
} from '@vp/domain';
import {
  type AuthorizationFailure,
  type ReadVideoFailure,
  decideChannelAnalyticsRead,
  decideVideoAnalyticsRead,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, isErr, ok } from '@vp/result';

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
      previous: previous && { rangeViews: previous.views, rangeWatchSeconds: previous.watchSeconds },
    });
  }

  async videoRetention(
    viewer: UserContext,
    videoId: string,
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
    range: AnalyticsRange
  ): Promise<Result<ChannelAnalytics, ChannelAnalyticsFailure>> {
    const allowed = decideChannelAnalyticsRead(viewer);
    if (isErr(allowed)) return allowed;
    const ownerId = allowed.value.id;

    const now = new Date(this.deps.now());
    const periods = analyticsPeriods(range, now);
    const rows = await this.deps.videoViews.channelTimeline(ownerId, periodsSpan(periods));
    if (isErr(rows)) return rows;
    const totals = await this.deps.videoViews.channelTotals(ownerId);
    if (isErr(totals)) return totals;
    const topVideos = await this.deps.videoViews.topVideos(
      ownerId,
      periods.current,
      TOP_VIDEOS_LIMIT
    );
    if (isErr(topVideos)) return topVideos;
    const hours = hourlyWindow(now);
    const hourly = await this.deps.videoViews.channelHourly(ownerId, hours);
    if (isErr(hourly)) return hourly;
    const netSubscribers = await this.deps.subscriptions.netSubscribers(ownerId, periods.current);
    if (isErr(netSubscribers)) return netSubscribers;
    const previousSubscribers = periods.previous
      ? await this.deps.subscriptions.netSubscribers(ownerId, periods.previous)
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
