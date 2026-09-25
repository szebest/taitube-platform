import type {
  ChannelViewTotals,
  DailyViews,
  TopVideo,
  ViewBatch,
  ViewBatchOutcome,
  ViewDateRange,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * `applyBatch` is effectively-once per batch id: the counters, the daily rows and the record of
 * the batch commit together, so a batch applied before a crash reports `already-applied` when the
 * flush retries it. Counts for a video that no longer exists are dropped.
 */
export interface VideoViewRepositoryPort {
  applyBatch(batch: ViewBatch): Promise<Result<ViewBatchOutcome, DatabaseUnavailable>>;
  /** Only a batch no flush can still retry may be forgotten, or its retry would count it twice. */
  forgetBatchesBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>>;
  videoTimeline(
    videoId: string,
    range: ViewDateRange
  ): Promise<Result<DailyViews[], DatabaseUnavailable>>;
  channelTimeline(
    ownerId: string,
    range: ViewDateRange
  ): Promise<Result<DailyViews[], DatabaseUnavailable>>;
  channelTotals(ownerId: string): Promise<Result<ChannelViewTotals, DatabaseUnavailable>>;
  topVideos(
    ownerId: string,
    range: ViewDateRange,
    limit: number
  ): Promise<Result<TopVideo[], DatabaseUnavailable>>;
}
