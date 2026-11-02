import { MS_PER_DAY, MS_PER_SECOND } from '@vp/domain/time';
import { type HourlyViewCount, type ViewHour, viewHourOf } from './hourly-views';
import type { RetentionCount } from './retention';

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
  readonly retention: readonly RetentionCount[];
  readonly hourly: readonly HourlyViewCount[];
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

export const ANALYTICS_RANGES = ['7d', '30d', '90d', 'lifetime'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

const RANGE_DAYS: Record<Exclude<AnalyticsRange, 'lifetime'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const LIFETIME_FROM: ViewDate = '1970-01-01';

export const TOP_VIDEOS_LIMIT = 5;

export type ViewTotals = Pick<DailyViews, 'views' | 'watchSeconds'>;

export interface AnalyticsPeriods {
  readonly current: ViewDateRange;
  /** As many days as `current`, ending the day before it; lifetime has none. */
  readonly previous: ViewDateRange | null;
}

export interface ViewsSummary extends ViewDateRange {
  readonly timeline: DailyViews[];
  readonly previous: ViewTotals | null;
}

export function viewDateOf(instant: Date): ViewDate {
  return instant.toISOString().slice(0, 10);
}

/** The day and the hour one view counts in, read from the same instant so they never disagree. */
export function viewBucketsOf(instant: Date): { viewDate: ViewDate; viewHour: ViewHour } {
  return { viewDate: viewDateOf(instant), viewHour: viewHourOf(instant) };
}

function shiftDays(viewDate: ViewDate, days: number): ViewDate {
  return viewDateOf(new Date(Date.parse(viewDate) + days * MS_PER_DAY));
}

function inRange(viewDate: ViewDate, range: ViewDateRange): boolean {
  return viewDate >= range.from && viewDate <= range.to;
}

/** A fixed range is its last days, today included, so a 7-day range holds exactly seven buckets. */
export function analyticsPeriods(range: AnalyticsRange, today: Date): AnalyticsPeriods {
  const to = viewDateOf(today);
  if (range === 'lifetime') return { current: { from: LIFETIME_FROM, to }, previous: null };

  const days = RANGE_DAYS[range];
  const from = shiftDays(to, 1 - days);
  return {
    current: { from, to },
    previous: { from: shiftDays(from, -days), to: shiftDays(from, -1) },
  };
}

/** The days one read must cover to serve both periods. */
export function periodsSpan({ current, previous }: AnalyticsPeriods): ViewDateRange {
  return { from: (previous ?? current).from, to: current.to };
}

/** Lifetime starts at its first counted day, so its timeline holds no empty years. */
export function summarizeViews(
  { current, previous }: AnalyticsPeriods,
  rows: readonly DailyViews[]
): ViewsSummary {
  const counted = rows.filter((row) => inRange(row.viewDate, current));
  const from = previous
    ? current.from
    : counted.reduce((first, row) => (row.viewDate < first ? row.viewDate : first), current.to);
  const range = { from, to: current.to };
  return {
    ...range,
    timeline: fillTimeline(range, counted),
    previous: previous && sumViews(rows.filter((row) => inRange(row.viewDate, previous))),
  };
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
  totals: ViewTotals,
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

export function sumViews(rows: readonly DailyViews[]): ViewTotals {
  return rows.reduce(
    (total, row) => ({
      views: total.views + row.views,
      watchSeconds: total.watchSeconds + row.watchSeconds,
    }),
    { views: 0, watchSeconds: 0 }
  );
}
