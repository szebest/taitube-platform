import { MS_PER_HOUR } from '@vp/domain/time';

/** The start of a UTC hour as an ISO instant, `YYYY-MM-DDTHH:00:00.000Z`. */
export type ViewHour = string;

export interface HourlyViewCount {
  readonly videoId: string;
  readonly viewHour: ViewHour;
  readonly views: number;
}

export interface HourlyViews {
  readonly viewHour: ViewHour;
  readonly views: number;
}

export interface ViewHourRange {
  readonly from: ViewHour;
  readonly to: ViewHour;
}

export const HOURLY_WINDOW_HOURS = 48;

export function viewHourOf(instant: Date): ViewHour {
  return new Date(Math.floor(instant.getTime() / MS_PER_HOUR) * MS_PER_HOUR).toISOString();
}

export function hourlyWindow(now: Date): ViewHourRange {
  const to = viewHourOf(now);
  const from = new Date(Date.parse(to) - (HOURLY_WINDOW_HOURS - 1) * MS_PER_HOUR).toISOString();
  return { from, to };
}

export interface FirstHoursWindow {
  readonly range: ViewHourRange;
  readonly endsAt: string;
}

/** The 48 hour slots from the hour a video became ready, and the instant its first 48 hours end. */
export function firstHoursWindow(readyAt: Date): FirstHoursWindow {
  const from = viewHourOf(readyAt);
  const to = new Date(Date.parse(from) + (HOURLY_WINDOW_HOURS - 1) * MS_PER_HOUR).toISOString();
  return {
    range: { from, to },
    endsAt: new Date(readyAt.getTime() + HOURLY_WINDOW_HOURS * MS_PER_HOUR).toISOString(),
  };
}

/** The earliest `readyAt` whose first 48 hours still include `now`, exclusive. */
export function firstHoursSince(now: Date): Date {
  return new Date(now.getTime() - HOURLY_WINDOW_HOURS * MS_PER_HOUR);
}

export function fillHourly(range: ViewHourRange, rows: readonly HourlyViews[]): HourlyViews[] {
  const byHour = new Map(rows.map((row) => [row.viewHour, row.views]));
  const hours: HourlyViews[] = [];
  for (let at = Date.parse(range.from); at <= Date.parse(range.to); at += MS_PER_HOUR) {
    const viewHour = new Date(at).toISOString();
    hours.push({ viewHour, views: byHour.get(viewHour) ?? 0 });
  }
  return hours;
}

export function mergeHourlyCounts(counts: readonly HourlyViewCount[]): HourlyViewCount[] {
  const merged = new Map<string, HourlyViewCount>();
  for (const count of counts) {
    const key = `${count.videoId}|${count.viewHour}`;
    const held = merged.get(key);
    merged.set(key, held ? { ...held, views: held.views + count.views } : count);
  }
  return [...merged.values()];
}
