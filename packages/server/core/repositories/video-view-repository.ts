import type { DatabaseUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type {
  ChannelViewTotals,
  DailyViews,
  DeviceViews,
  FirstWeekRow,
  HourlyViews,
  PeerVideo,
  RetentionPoint,
  TopVideo,
  ViewBatch,
  ViewBatchOutcome,
  ViewDateRange,
  ViewHourRange,
} from '@vp/domain';

/**
 * `applyBatch` is effectively-once per batch id: the counters, the daily, device and hourly rows, the retention steps
 * and the record of the batch commit together, so a batch applied before a crash reports `already-applied` when the
 * flush retries it. Counts and steps for a video that no longer exists are dropped.
 */
export interface VideoViewRepositoryPort {
  applyBatch(batch: ViewBatch): Promise<Result<ViewBatchOutcome, DatabaseUnavailable>>;
  /** Only a batch no flush can still retry may be forgotten, or its retry would count it twice. */
  forgetBatchesBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>>;
  forgetHoursBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>>;
  /** The steps with viewers, ascending by percent; a step nobody reached is absent. */
  retentionCurve(videoId: string): Promise<Result<RetentionPoint[], DatabaseUnavailable>>;
  /** A video's counted views per device over the range, most viewed first; a device nobody used is absent. */
  videoDevices(
    videoId: string,
    range: ViewDateRange
  ): Promise<Result<DeviceViews[], DatabaseUnavailable>>;
  videoTimeline(
    videoId: string,
    range: ViewDateRange
  ): Promise<Result<DailyViews[], DatabaseUnavailable>>;
  channelTimeline(
    channelId: string,
    range: ViewDateRange
  ): Promise<Result<DailyViews[], DatabaseUnavailable>>;
  videoHourly(
    videoId: string,
    range: ViewHourRange
  ): Promise<Result<HourlyViews[], DatabaseUnavailable>>;
  channelHourly(
    channelId: string,
    range: ViewHourRange
  ): Promise<Result<HourlyViews[], DatabaseUnavailable>>;
  /** Views per UTC day offset (0 to 6) from each video's `ready_at` day, for the videos that have one; a day without views is absent. */
  firstWeekViews(videoIds: readonly string[]): Promise<Result<FirstWeekRow[], DatabaseUnavailable>>;
  /** The channel's most recently ready public videos that became ready at or before `readyBefore`, newest first, never `excludeVideoId`. */
  recentPeers(
    channelId: string,
    excludeVideoId: string,
    readyBefore: Date,
    limit: number
  ): Promise<Result<PeerVideo[], DatabaseUnavailable>>;
  channelTotals(channelId: string): Promise<Result<ChannelViewTotals, DatabaseUnavailable>>;
  topVideos(
    channelId: string,
    range: ViewDateRange,
    limit: number
  ): Promise<Result<TopVideo[], DatabaseUnavailable>>;
}
