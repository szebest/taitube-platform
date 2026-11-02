import type { VideoRecord, VideoViewRepositoryPort } from '@vp/core/repositories';
import {
  type ChannelViewTotals,
  type DailyViews,
  type HourlyViewCount,
  type HourlyViews,
  type RetentionCount,
  type RetentionPoint,
  type TopVideo,
  type ViewBatch,
  type ViewBatchOutcome,
  type ViewCount,
  type ViewDateRange,
  type ViewHourRange,
  mergeHourlyCounts,
  mergeViewCounts,
  sumViews,
  viewsByVideo,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';

/** The two things the view counters need from the videos they count. */
export interface ViewedVideos {
  getAllVideos(): VideoRecord[];
  addViews(videoId: string, views: number): void;
}

function inRange(viewDate: string, range: ViewDateRange): boolean {
  return viewDate >= range.from && viewDate <= range.to;
}

function inHours(viewHour: string, range: ViewHourRange): boolean {
  return Date.parse(viewHour) >= Date.parse(range.from) && Date.parse(viewHour) <= Date.parse(range.to);
}

function byHour(left: HourlyViews, right: HourlyViews): number {
  return Date.parse(left.viewHour) - Date.parse(right.viewHour);
}

function byDate(left: DailyViews, right: DailyViews): number {
  return left.viewDate.localeCompare(right.viewDate);
}

export class InMemoryVideoViewRepository implements VideoViewRepositoryPort {
  private readonly daily = new Map<string, ViewCount>();
  private readonly batches = new Map<string, Date>();
  private readonly retention = new Map<string, RetentionCount>();
  private readonly hourly = new Map<string, HourlyViewCount>();

  constructor(private readonly videos: ViewedVideos) {}

  async applyBatch(batch: ViewBatch): Promise<Result<ViewBatchOutcome, DatabaseUnavailable>> {
    if (this.batches.has(batch.batchId)) return ok({ type: 'already-applied' });
    this.batches.set(batch.batchId, new Date());

    const existing = new Set(this.live().map((video) => video.id));
    const kept = mergeViewCounts(batch.counts).filter((count) => existing.has(count.videoId));
    for (const count of kept) {
      const key = `${count.videoId}|${count.viewDate}`;
      const held = this.daily.get(key);
      this.daily.set(key, {
        ...count,
        views: count.views + (held?.views ?? 0),
        watchSeconds: count.watchSeconds + (held?.watchSeconds ?? 0),
      });
    }

    for (const step of batch.retention.filter(({ videoId }) => existing.has(videoId))) {
      const stepKey = `${step.videoId}|${step.percent}`;
      const held = this.retention.get(stepKey);
      this.retention.set(stepKey, { ...step, viewers: step.viewers + (held?.viewers ?? 0) });
    }

    for (const count of mergeHourlyCounts(batch.hourly)) {
      if (!existing.has(count.videoId)) continue;
      const hourKey = `${count.videoId}|${count.viewHour}`;
      const held = this.hourly.get(hourKey);
      this.hourly.set(hourKey, { ...count, views: count.views + (held?.views ?? 0) });
    }

    const deltas = viewsByVideo(kept);
    for (const { videoId, views } of deltas) this.videos.addViews(videoId, views);
    return ok({ type: 'applied', views: deltas.reduce((sum, delta) => sum + delta.views, 0) });
  }

  async forgetBatchesBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    let forgotten = 0;
    for (const [batchId, appliedAt] of this.batches) {
      if (appliedAt < cutoff) {
        this.batches.delete(batchId);
        forgotten += 1;
      }
    }
    return ok(forgotten);
  }

  async forgetHoursBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    let forgotten = 0;
    for (const [key, count] of this.hourly) {
      if (Date.parse(count.viewHour) < cutoff.getTime()) {
        this.hourly.delete(key);
        forgotten += 1;
      }
    }
    return ok(forgotten);
  }

  async retentionCurve(videoId: string): Promise<Result<RetentionPoint[], DatabaseUnavailable>> {
    return ok(
      [...this.retention.values()]
        .filter((count) => count.videoId === videoId)
        .map(({ percent, viewers }) => ({ percent, viewers }))
        .sort((left, right) => left.percent - right.percent)
    );
  }

  async videoTimeline(
    videoId: string,
    range: ViewDateRange
  ): Promise<Result<DailyViews[], DatabaseUnavailable>> {
    return ok(
      this.rowsFor(new Set([videoId]), range)
        .map(({ viewDate, views, watchSeconds }) => ({ viewDate, views, watchSeconds }))
        .sort(byDate)
    );
  }

  async channelTimeline(
    ownerId: string,
    range: ViewDateRange
  ): Promise<Result<DailyViews[], DatabaseUnavailable>> {
    const days = new Map<string, DailyViews[]>();
    for (const row of this.rowsFor(this.ownedIds(ownerId), range)) {
      days.set(row.viewDate, [...(days.get(row.viewDate) ?? []), row]);
    }
    return ok(
      [...days.entries()].map(([viewDate, rows]) => ({ viewDate, ...sumViews(rows) })).sort(byDate)
    );
  }

  async videoHourly(
    videoId: string,
    range: ViewHourRange
  ): Promise<Result<HourlyViews[], DatabaseUnavailable>> {
    return ok(this.hoursFor(new Set([videoId]), range));
  }

  async channelHourly(
    ownerId: string,
    range: ViewHourRange
  ): Promise<Result<HourlyViews[], DatabaseUnavailable>> {
    return ok(this.hoursFor(this.ownedIds(ownerId), range));
  }

  async channelTotals(ownerId: string): Promise<Result<ChannelViewTotals, DatabaseUnavailable>> {
    const owned = this.live().filter((video) => video.ownerId === ownerId);
    return ok({
      totalViews: owned.reduce((sum, video) => sum + (video.viewsCount ?? 0), 0),
      videoCount: owned.length,
    });
  }

  async topVideos(
    ownerId: string,
    range: ViewDateRange,
    limit: number
  ): Promise<Result<TopVideo[], DatabaseUnavailable>> {
    const views = new Map(
      viewsByVideo(this.rowsFor(this.ownedIds(ownerId), range)).map((row) => [
        row.videoId,
        row.views,
      ])
    );
    const top = this.live()
      .filter((video) => views.has(video.id))
      .map((video) => ({
        videoId: video.id,
        title: video.title ?? '',
        views: views.get(video.id) ?? 0,
        totalViews: video.viewsCount ?? 0,
      }))
      .sort((left, right) => right.views - left.views || left.videoId.localeCompare(right.videoId));
    return ok(top.slice(0, limit));
  }

  clear(): void {
    this.daily.clear();
    this.batches.clear();
    this.retention.clear();
    this.hourly.clear();
  }

  private live(): VideoRecord[] {
    return this.videos.getAllVideos().filter((video) => !video.deletedAt);
  }

  private ownedIds(ownerId: string): Set<string> {
    return new Set(
      this.live()
        .filter((video) => video.ownerId === ownerId)
        .map((video) => video.id)
    );
  }

  private rowsFor(videoIds: ReadonlySet<string>, range: ViewDateRange): ViewCount[] {
    return [...this.daily.values()].filter(
      (row) => videoIds.has(row.videoId) && inRange(row.viewDate, range)
    );
  }

  private hoursFor(videoIds: ReadonlySet<string>, range: ViewHourRange): HourlyViews[] {
    const hours = new Map<string, number>();
    for (const count of this.hourly.values()) {
      if (videoIds.has(count.videoId) && inHours(count.viewHour, range)) {
        hours.set(count.viewHour, (hours.get(count.viewHour) ?? 0) + count.views);
      }
    }
    return [...hours.entries()].map(([viewHour, views]) => ({ viewHour, views })).sort(byHour);
  }
}
