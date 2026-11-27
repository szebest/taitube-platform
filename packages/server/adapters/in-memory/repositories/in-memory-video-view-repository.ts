import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, ok } from '@kit/result';
import type { VideoRecord, VideoViewRepositoryPort } from '@vp/core/repositories';
import {
  type ChannelViewTotals,
  type DailyViews,
  type DeviceViewCount,
  type DeviceViews,
  type ExperimentCount,
  type FirstWeekRow,
  type PeerVideo,
  type HourlyViewCount,
  type HourlyViews,
  type RetentionCount,
  type RetentionPoint,
  type ShareLinkCount,
  type TopVideo,
  type ViewBatch,
  type ViewBatchOutcome,
  type ViewCount,
  type ViewDateRange,
  type ViewDevice,
  type ViewHourRange,
  mergeDeviceCounts,
  mergeHourlyCounts,
  mergeViewCounts,
  sumViews,
  viewsByVideo,
} from '@vp/domain';
import { firstWeekRowsOf, recentPeersOf } from './in-memory-first-week';
import { byDate, byHour, inHours, inRange } from './in-memory-view-ranges';

/** The two things the view counters need from the videos they count. */
export interface ViewedVideos {
  getAllVideos(): VideoRecord[];
  addViews(videoId: string, views: number): void;
}

/** The in-memory share link and experiment stores, which hold the numbers a flush adds for them. */
export interface ViewStatsSinks {
  shareLinks: { addStats(counts: readonly ShareLinkCount[]): void };
  experiments: { addStats(counts: readonly ExperimentCount[]): void };
}

export class InMemoryVideoViewRepository implements VideoViewRepositoryPort {
  private readonly daily = new Map<string, ViewCount>();
  private readonly batches = new Map<string, Date>();
  private readonly retention = new Map<string, RetentionCount>();
  private readonly hourly = new Map<string, HourlyViewCount>();
  private readonly devices = new Map<string, DeviceViewCount>();

  constructor(
    private readonly videos: ViewedVideos,
    private readonly sinks: ViewStatsSinks
  ) {}

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

    for (const count of mergeDeviceCounts(batch.devices)) {
      if (!existing.has(count.videoId)) continue;
      const deviceKey = `${count.videoId}|${count.viewDate}|${count.device}`;
      const held = this.devices.get(deviceKey);
      this.devices.set(deviceKey, { ...count, views: count.views + (held?.views ?? 0) });
    }

    this.sinks.shareLinks.addStats(batch.shareLinks);
    this.sinks.experiments.addStats(batch.experiments);

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

  dailyCounts(): ViewCount[] {
    return [...this.daily.values()].map((count) => ({ ...count }));
  }

  retentionCounts(): RetentionCount[] {
    return [...this.retention.values()].map((count) => ({ ...count }));
  }

  async retentionCurve(videoId: string): Promise<Result<RetentionPoint[], DatabaseUnavailable>> {
    return ok(
      [...this.retention.values()]
        .filter((count) => count.videoId === videoId)
        .map(({ percent, viewers }) => ({ percent, viewers }))
        .sort((left, right) => left.percent - right.percent)
    );
  }

  replaceRetention(videoId: string, points: readonly RetentionPoint[]): void {
    for (const [key, step] of this.retention)
      if (step.videoId === videoId) this.retention.delete(key);
    for (const p of points) this.retention.set(`${videoId}|${p.percent}`, { ...p, videoId });
  }

  async videoDevices(
    videoId: string,
    range: ViewDateRange
  ): Promise<Result<DeviceViews[], DatabaseUnavailable>> {
    const totals = new Map<ViewDevice, number>();
    for (const count of this.devices.values()) {
      if (count.videoId === videoId && inRange(count.viewDate, range)) {
        totals.set(count.device, (totals.get(count.device) ?? 0) + count.views);
      }
    }
    return ok(
      [...totals.entries()]
        .map(([device, views]) => ({ device, views }))
        .sort((left, right) => right.views - left.views || left.device.localeCompare(right.device))
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
    channelId: string,
    range: ViewDateRange
  ): Promise<Result<DailyViews[], DatabaseUnavailable>> {
    const days = new Map<string, DailyViews[]>();
    for (const row of this.rowsFor(this.ownedIds(channelId), range)) {
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
    channelId: string,
    range: ViewHourRange
  ): Promise<Result<HourlyViews[], DatabaseUnavailable>> {
    return ok(this.hoursFor(this.ownedIds(channelId), range));
  }

  async firstWeekViews(
    videoIds: readonly string[]
  ): Promise<Result<FirstWeekRow[], DatabaseUnavailable>> {
    const wanted = new Set(videoIds);
    return ok(
      firstWeekRowsOf(
        this.videos.getAllVideos().filter((video) => wanted.has(video.id)),
        [...this.daily.values()]
      )
    );
  }

  async recentPeers(
    channelId: string,
    excludeVideoId: string,
    readyBefore: Date,
    limit: number
  ): Promise<Result<PeerVideo[], DatabaseUnavailable>> {
    return ok(recentPeersOf(this.live(), channelId, excludeVideoId, readyBefore).slice(0, limit));
  }

  async channelTotals(channelId: string): Promise<Result<ChannelViewTotals, DatabaseUnavailable>> {
    const owned = this.live().filter((video) => video.channelId === channelId);
    return ok({
      totalViews: owned.reduce((sum, video) => sum + (video.viewsCount ?? 0), 0),
      videoCount: owned.length,
    });
  }

  async topVideos(
    channelId: string,
    range: ViewDateRange,
    limit: number
  ): Promise<Result<TopVideo[], DatabaseUnavailable>> {
    const views = new Map(
      viewsByVideo(this.rowsFor(this.ownedIds(channelId), range)).map((row) => [
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
    this.devices.clear();
  }

  private live(): VideoRecord[] {
    return this.videos.getAllVideos().filter((video) => !video.deletedAt);
  }

  private ownedIds(channelId: string): Set<string> {
    return new Set(
      this.live()
        .filter((video) => video.channelId === channelId)
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
