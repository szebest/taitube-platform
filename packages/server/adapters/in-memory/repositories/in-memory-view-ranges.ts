import type { DailyViews, HourlyViews, ViewDateRange, ViewHourRange } from '@vp/domain';

export function inRange(viewDate: string, range: ViewDateRange): boolean {
  return viewDate >= range.from && viewDate <= range.to;
}

export function inHours(viewHour: string, range: ViewHourRange): boolean {
  return (
    Date.parse(viewHour) >= Date.parse(range.from) && Date.parse(viewHour) <= Date.parse(range.to)
  );
}

export function byHour(left: HourlyViews, right: HourlyViews): number {
  return Date.parse(left.viewHour) - Date.parse(right.viewHour);
}

export function byDate(left: DailyViews, right: DailyViews): number {
  return left.viewDate.localeCompare(right.viewDate);
}
