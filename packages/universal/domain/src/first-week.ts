import { MS_PER_DAY } from '@kit/primitives';
import { viewDateOf } from './views';

export const FIRST_WEEK_DAYS = 7;
export const BENCHMARK_PEER_LIMIT = 10;
const BENCHMARK_MIN_PEERS = 3;

/** One video's views on the UTC day `dayOffset` after the UTC day it became ready. */
export interface FirstWeekRow {
  readonly videoId: string;
  readonly dayOffset: number;
  readonly views: number;
}

export interface PeerVideo {
  readonly videoId: string;
  readonly readyAt: Date;
}

export interface BenchmarkBand {
  readonly p25: number;
  readonly median: number;
  readonly p75: number;
}

/**
 * Cumulative views by the end of each UTC day since `readyAt`, one entry per day that has begun by
 * `today`, so a video younger than a week has fewer than seven and the current day counts as begun.
 */
export function cumulativeFirstWeek(
  rows: readonly Pick<FirstWeekRow, 'dayOffset' | 'views'>[],
  readyAt: Date,
  today: Date
): number[] {
  const elapsed = Math.floor(
    (Date.parse(viewDateOf(today)) - Date.parse(viewDateOf(readyAt))) / MS_PER_DAY
  );
  const reached = Math.min(FIRST_WEEK_DAYS, Math.max(0, elapsed + 1));
  const perDay = Array.from({ length: reached }, (_, day) =>
    rows.filter((row) => row.dayOffset === day).reduce((sum, row) => sum + row.views, 0)
  );
  let total = 0;
  return perDay.map((views) => (total += views));
}

function percentile(sorted: readonly number[], fraction: number): number {
  const rank = fraction * (sorted.length - 1);
  const below = Math.floor(rank);
  const lower = sorted[below] ?? 0;
  const upper = sorted[Math.ceil(rank)] ?? lower;
  return lower + (upper - lower) * (rank - below);
}

/** Per day of the first week, the 25th, 50th and 75th percentile across peers by linear interpolation; null under three peers. */
export function benchmarkEnvelope(
  peerSeries: readonly (readonly number[])[]
): BenchmarkBand[] | null {
  if (peerSeries.length < BENCHMARK_MIN_PEERS) return null;
  return Array.from({ length: FIRST_WEEK_DAYS }, (_, day) => {
    const sorted = peerSeries
      .map((series) => series[day] ?? series.at(-1) ?? 0)
      .sort((left, right) => left - right);
    return {
      p25: percentile(sorted, 0.25),
      median: percentile(sorted, 0.5),
      p75: percentile(sorted, 0.75),
    };
  });
}

export interface BenchmarkDay {
  readonly day: number;
  readonly views: number | null;
  readonly p25: number | null;
  readonly median: number | null;
  readonly p75: number | null;
}

/** The seven days of the first week, the video's own cumulative views where its day has begun and the envelope where there is one. */
export function benchmarkDays(
  own: readonly number[],
  envelope: readonly BenchmarkBand[] | null
): BenchmarkDay[] {
  return Array.from({ length: FIRST_WEEK_DAYS }, (_, day) => ({
    day,
    views: own[day] ?? null,
    p25: envelope?.[day]?.p25 ?? null,
    median: envelope?.[day]?.median ?? null,
    p75: envelope?.[day]?.p75 ?? null,
  }));
}
