import { type Result, andThen, err, map, ok } from '@kit/result';
import { partNumber } from '../civil';
import type { FormatContext } from '../context';
import { type FormatFailure, unrenderable } from '../failures';
import { type DateStyle, formatInstant } from '../format-instant';
import { isString, parseInstant } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';
import { referenceInstant } from '../reference-instant';
import { DAY, MILLISECONDS_PER_SECOND } from '../time-spans';

const CALENDAR_DAY_OPTION_KEYS = [
  'now',
  'withTime',
  'style',
  'windowDays',
] as const satisfies OptionKeys<CalendarDayOptions>;

/**
 * `now` is the instant whose day is today, else the context's. `windowDays` is how many days
 * either side read as a word (1 by default), `style` how a date beyond it reads, and `withTime`
 * (on by default) puts the clock after `today`.
 */
export interface CalendarDayOptions {
  readonly now?: string;
  readonly withTime?: boolean;
  readonly style?: DateStyle;
  readonly windowDays?: number;
}

const DAY_MS = DAY * MILLISECONDS_PER_SECOND;

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
    const { withTime = true, style = 'medium', windowDays = 1 } = options ?? {};
    if (!Number.isInteger(windowDays) || windowDays < 0) {
      return err(unrenderable('calendarDay', `windowDays ${windowDays} is not a whole number`));
    }
    return andThen(parseInstant('calendarDay', value), (then) =>
      andThen(referenceInstant('calendarDay', options?.now, context), (now) =>
        andThen(calendarDaysBetween(now, then, context), (days) => {
          if (Math.abs(days) > windowDays) {
            return formatInstant('calendarDay', value, { dateStyle: style }, context);
          }
          return andThen(cache.relativeTimeFormat(locale, { numeric: 'auto' }), (relativeDay) => {
            const dayWord = relativeDay.format(days, 'day');
            if (days !== 0 || !withTime) return ok(dayWord);
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
