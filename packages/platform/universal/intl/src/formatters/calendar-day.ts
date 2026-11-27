import { type Result, andThen, map, ok } from '@kit/result';
import type { FormatContext } from '../context';
import type { FormatFailure } from '../failures';
import { formatInstant } from '../format-instant';
import { isString, parseInstant } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';
import { referenceInstant } from '../reference-instant';
import { DAY, MILLISECONDS_PER_SECOND } from '../time-spans';

const CALENDAR_DAY_OPTION_KEYS = ['now'] as const satisfies OptionKeys<CalendarDayOptions>;

/** `now` is the instant whose day is today, else the context's. */
export interface CalendarDayOptions {
  readonly now?: string;
}

const DAY_MS = DAY * MILLISECONDS_PER_SECOND;

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
export const calendarDay = defineKind({
  name: 'calendarDay',
  arg: isString,
  options: optionKeys<CalendarDayOptions>(CALENDAR_DAY_OPTION_KEYS),
  render: (value, options, context) => {
    const { cache, locale } = context;
    return andThen(parseInstant('calendarDay', value), (then) =>
      andThen(referenceInstant('calendarDay', options?.now, context), (now) =>
        andThen(calendarDaysBetween(now, then, context), (days) => {
          if (Math.abs(days) > 1) {
            return formatInstant('calendarDay', value, { dateStyle: 'medium' }, context);
          }
          return andThen(cache.relativeTimeFormat(locale, { numeric: 'auto' }), (relativeDay) => {
            const dayWord = relativeDay.format(days, 'day');
            if (days !== 0) return ok(dayWord);
            return andThen(
              formatInstant('calendarDay', value, { timeStyle: 'short' }, context),
              (clock) =>
                map(cache.listFormat(locale, { type: 'unit', style: 'narrow' }), (list) =>
                  list.format([dayWord, clock])
                )
            );
          });
        })
      )
    );
  },
});

/** @public */
export type CalendarDayValue = TaggedOf<typeof calendarDay>;
