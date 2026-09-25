import { MS_PER_DAY, MS_PER_SECOND } from '@vp/domain/time';

/** A UTC calendar day, `YYYY-MM-DD`: the bucket a view is counted in. */
export type ViewDate = string;

export interface ViewCount {
  readonly videoId: string;
  readonly viewDate: ViewDate;
  readonly views: number;
  readonly watchSeconds: number;
}

/** What one flush drains and applies; the id is what makes a replayed apply a no-op. */
export interface ViewBatch {
  readonly batchId: string;
  readonly counts: readonly ViewCount[];
}

export type ViewBatchOutcome =
  | { readonly type: 'applied'; readonly views: number }
  | { readonly type: 'already-applied' };

export interface DailyViews {
  readonly viewDate: ViewDate;
  readonly views: number;
  readonly watchSeconds: number;
}

export interface ViewDateRange {
  readonly from: ViewDate;
  readonly to: ViewDate;
}

export interface TopVideo {
  readonly videoId: string;
  readonly title: string;
  readonly views: number;
  readonly totalViews: number;
}

export interface ChannelViewTotals {
  readonly totalViews: number;
  readonly videoCount: number;
}

export const ANALYTICS_RANGES = ['7d', '30d', '90d'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

const RANGE_DAYS: Record<AnalyticsRange, number> = { '7d': 7, '30d': 30, '90d': 90 };

export const TOP_VIDEOS_LIMIT = 5;

export function viewDateOf(instant: Date): ViewDate {
  return instant.toISOString().slice(0, 10);
}

/** The last `range` days, today included, so a 7-day range holds exactly seven buckets. */
export function viewDateRange(range: AnalyticsRange, today: Date): ViewDateRange {
  const to = viewDateOf(today);
  const from = viewDateOf(new Date(Date.parse(to) - (RANGE_DAYS[range] - 1) * MS_PER_DAY));
  return { from, to };
}

export function rangeDays(range: AnalyticsRange): number {
  return RANGE_DAYS[range];
}

export function fillTimeline(range: ViewDateRange, rows: readonly DailyViews[]): DailyViews[] {
  const byDate = new Map(rows.map((row) => [row.viewDate, row]));
  const days: DailyViews[] = [];
  for (let at = Date.parse(range.from); at <= Date.parse(range.to); at += MS_PER_DAY) {
    const viewDate = viewDateOf(new Date(at));
    days.push(byDate.get(viewDate) ?? { viewDate, views: 0, watchSeconds: 0 });
  }
  return days;
}

/** The share of the video the average view watched, `null` while nothing can be divided. */
export function averageRetention(
  totals: Pick<DailyViews, 'views' | 'watchSeconds'>,
  durationMs: number | null
): number | null {
  if (!durationMs || totals.views === 0) return null;
  const ratio = (totals.watchSeconds * MS_PER_SECOND) / (totals.views * durationMs);
  return Math.min(1, ratio);
}

export function mergeViewCounts(counts: readonly ViewCount[]): ViewCount[] {
  const merged = new Map<string, ViewCount>();
  for (const count of counts) {
    const key = `${count.videoId}|${count.viewDate}`;
    const held = merged.get(key);
    merged.set(
      key,
      held
        ? {
            ...held,
            views: held.views + count.views,
            watchSeconds: held.watchSeconds + count.watchSeconds,
          }
        : count
    );
  }
  return [...merged.values()];
}

/** Each video's total across days, ordered by id so writers lock rows in one order. */
export function viewsByVideo(
  counts: readonly ViewCount[]
): { readonly videoId: string; readonly views: number }[] {
  const totals = new Map<string, number>();
  for (const count of counts) {
    totals.set(count.videoId, (totals.get(count.videoId) ?? 0) + count.views);
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([videoId, views]) => ({ videoId, views }));
}

export function sumViews(rows: readonly DailyViews[]): Pick<DailyViews, 'views' | 'watchSeconds'> {
  return rows.reduce(
    (total, row) => ({
      views: total.views + row.views,
      watchSeconds: total.watchSeconds + row.watchSeconds,
    }),
    { views: 0, watchSeconds: 0 }
  );
}
