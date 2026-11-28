import { type Result, map } from '@kit/result';
import type { FormatContext } from './context';
import type { FormatFailure } from './failures';

export function partNumber(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): number {
  return Number(parts.find((part) => part.type === type)?.value);
}

const CLOCK_FIELDS = ['day', 'hour', 'minute', 'second'] as const;

/**
 * Whole calendar months from `from` to `to` as a wall clock in the context's zone reads them,
 * negative when `to` is earlier: Jan 31 to Feb 28 is not yet one.
 */
export function calendarMonthsBetween(
  from: Date,
  to: Date,
  context: FormatContext
): Result<number, FormatFailure> {
  const civil = context.cache.dateTimeFormat(context.locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
    numberingSystem: 'latn',
    timeZone: context.timeZone,
  });
  return map(civil, (format) => {
    const [earlier, later] = from <= to ? [from, to] : [to, from];
    const first = format.formatToParts(earlier);
    const last = format.formatToParts(later);
    const months =
      (partNumber(last, 'year') - partNumber(first, 'year')) * 12 +
      (partNumber(last, 'month') - partNumber(first, 'month'));
    const clockNotReached = CLOCK_FIELDS.map(
      (field) => partNumber(last, field) - partNumber(first, field)
    ).find((difference) => difference !== 0);
    const whole = clockNotReached !== undefined && clockNotReached < 0 ? months - 1 : months;
    return from <= to ? whole : -whole;
  });
}
