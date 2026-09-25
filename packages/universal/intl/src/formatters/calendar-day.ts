import { type Result, andThen, map, ok } from '@vp/result';
import type { FormatContext } from '../context';
import type { FormatFailure } from '../failures';
import { formatInstant } from '../format-instant';
import { parseInstant } from '../inputs';
import { referenceInstant } from '../reference-instant';

export interface CalendarDayValue {
  readonly type: 'calendarDay';
  readonly value: string;
  readonly now?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function partNumber(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(parts.find((part) => part.type === type)?.value);
}

/** Whole calendar days between two instants as a wall clock in the context's zone reads them. */
function calendarDaysBetween(
  from: Date,
  to: Date,
  context: FormatContext
): Result<number, FormatFailure> {
  const civil = context.cache.dateTimeFormat(context.locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    numberingSystem: 'latn',
    timeZone: context.timeZone,
  });
  return map(civil, (format) => {
    const dayNumber = (instant: Date) => {
      const parts = format.formatToParts(instant);
      const midnight = Date.UTC(
        partNumber(parts, 'year'),
        partNumber(parts, 'month') - 1,
        partNumber(parts, 'day')
      );
      return midnight / DAY_MS;
    };
    return dayNumber(to) - dayNumber(from);
  });
}

/**
 * `today 18:30` for today, `yesterday` / `tomorrow` either side, the medium date beyond. Casing is
 * the locale's own: a sentence-initial capital is the presentation layer's call, not this one.
 */
export function calendarDay(
  value: CalendarDayValue,
  context: FormatContext
): Result<string, FormatFailure> {
  const { cache, locale } = context;
  return andThen(parseInstant('calendarDay', value.value), (then) =>
    andThen(referenceInstant('calendarDay', value.now, context), (now) =>
      andThen(calendarDaysBetween(now, then, context), (days) => {
        if (Math.abs(days) > 1) {
          return formatInstant('calendarDay', value.value, { dateStyle: 'medium' }, context);
        }
        return andThen(cache.relativeTimeFormat(locale, { numeric: 'auto' }), (relativeDay) => {
          const dayWord = relativeDay.format(days, 'day');
          if (days !== 0) return ok(dayWord);
          return andThen(
            formatInstant('calendarDay', value.value, { timeStyle: 'short' }, context),
            (clock) =>
              map(cache.listFormat(locale, { type: 'unit', style: 'narrow' }), (list) =>
                list.format([dayWord, clock])
              )
          );
        });
      })
    )
  );
}
