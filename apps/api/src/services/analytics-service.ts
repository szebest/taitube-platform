import type { ChannelAnalytics, VideoAnalytics } from '@vp/api-contracts';
import type { VideoRepository, VideoViewRepositoryPort } from '@vp/core/repositories';
import {
  type AnalyticsRange,
  TOP_VIDEOS_LIMIT,
  averageRetention,
  fillTimeline,
  rangeDays,
  sumViews,
  viewDateRange,
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

    const dates = viewDateRange(range, new Date(this.deps.now()));
    const rows = await this.deps.videoViews.videoTimeline(videoId, dates);
    if (isErr(rows)) return rows;

    const timeline = fillTimeline(dates, rows.value);
    const totals = sumViews(timeline);
    return ok({
      videoId,
      range,
      ...dates,
      timeline,
      rangeViews: totals.views,
      totalViews: video.viewsCount ?? 0,
      averageDailyViews: totals.views / rangeDays(range),
      averageRetention: averageRetention(totals, video.durationMs),
    });
  }

  async channelAnalytics(
    viewer: UserContext,
    range: AnalyticsRange
  ): Promise<Result<ChannelAnalytics, ChannelAnalyticsFailure>> {
    const allowed = decideChannelAnalyticsRead(viewer);
    if (isErr(allowed)) return allowed;
    const ownerId = allowed.value.id;

    const dates = viewDateRange(range, new Date(this.deps.now()));
    const rows = await this.deps.videoViews.channelTimeline(ownerId, dates);
    if (isErr(rows)) return rows;
    const totals = await this.deps.videoViews.channelTotals(ownerId);
    if (isErr(totals)) return totals;
    const topVideos = await this.deps.videoViews.topVideos(ownerId, dates, TOP_VIDEOS_LIMIT);
    if (isErr(topVideos)) return topVideos;

    const timeline = fillTimeline(dates, rows.value);
    const rangeViews = sumViews(timeline).views;
    return ok({
      range,
      ...dates,
      timeline,
      rangeViews,
      ...totals.value,
      dailyVelocity: rangeViews / rangeDays(range),
      topVideos: topVideos.value,
    });
  }
}
