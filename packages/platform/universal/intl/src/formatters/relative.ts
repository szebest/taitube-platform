import { andThen, map } from '@kit/result';
import { calendarMonthsBetween } from '../civil';
import { isString, parseInstant } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';
import { referenceInstant } from '../reference-instant';
import {
  DAY,
  HOUR,
  MILLISECONDS_PER_SECOND,
  MINUTE,
  MONTH,
  SECOND,
  WEEK,
  YEAR,
} from '../time-spans';

const RELATIVE_OPTION_KEYS = [
  'numeric',
  'style',
  'pastOnly',
  'now',
  'minUnit',
  'maxUnit',
  'thresholds',
] as const satisfies OptionKeys<Intl.RelativeTimeFormatOptions, RelativeOnly>;

type RelativeOnly = 'pastOnly' | 'now' | 'minUnit' | 'maxUnit' | 'thresholds';

/** @public */
export type RelativeUnit = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second';

/**
 * `now` is the instant measured from, else the context's. `pastOnly` reads an instant after it
 * as `now`: a publish date is never in the future. `minUnit` and `maxUnit` bound the unit,
 * so `maxUnit: 'day'` reads 400 days, and `thresholds` set the seconds a unit needs before it
 * is used (`{ minute: 90 }` reads 75 seconds in seconds). A month and a year are calendar ones,
 * not 30 and 365 days, unless a threshold names them.
 */
type RelativeOptions = Pick<Intl.RelativeTimeFormatOptions, 'numeric' | 'style'> & {
  readonly pastOnly?: boolean;
  readonly now?: string;
  readonly minUnit?: RelativeUnit;
  readonly maxUnit?: RelativeUnit;
  readonly thresholds?: Readonly<Partial<Record<RelativeUnit, number>>>;
};

interface UnitSpan {
  readonly unit: RelativeUnit;
  readonly seconds: number;
}

const LARGEST_FIRST: readonly [UnitSpan, ...UnitSpan[]] = [
  { unit: 'year', seconds: YEAR },
  { unit: 'month', seconds: MONTH },
  { unit: 'week', seconds: WEEK },
  { unit: 'day', seconds: DAY },
  { unit: 'hour', seconds: HOUR },
  { unit: 'minute', seconds: MINUTE },
  { unit: 'second', seconds: SECOND },
];

const MONTHS_PER_YEAR = 12;

const roundHalfAwayFromZero = (value: number) => Math.sign(value) * Math.round(Math.abs(value));

interface Elapsed {
  readonly count: number;
  readonly unit: RelativeUnit;
}

interface Measure {
  readonly seconds: number;
  readonly months: number;
  readonly thresholds: Readonly<Partial<Record<RelativeUnit, number>>>;
}

function reaches({ unit, seconds }: UnitSpan, { seconds: elapsed, months, thresholds }: Measure) {
  const needed = thresholds[unit];
  if (needed !== undefined) return Math.abs(elapsed) >= needed;
  if (unit === 'year') return Math.abs(months) >= MONTHS_PER_YEAR;
  if (unit === 'month') return Math.abs(months) >= 1;
  return Math.abs(elapsed) >= seconds;
}

function countIn({ unit, seconds }: UnitSpan, measure: Measure): number {
  if (unit === 'year') return Math.trunc(measure.months / MONTHS_PER_YEAR);
  if (unit === 'month') return measure.months;
  return roundHalfAwayFromZero(measure.seconds / seconds);
}

/**
 * The largest allowed unit the span reaches, rounded the same way either side of now; a count
 * that rounds up to the next unit (59.5 minutes) is read in that unit (1 hour), never as 60 minutes.
 */
function inLargestUnit(measure: Measure, allowed: readonly [UnitSpan, ...UnitSpan[]]): Elapsed {
  const reached = allowed.findIndex((span) => reaches(span, measure));
  const index = reached === -1 ? allowed.length - 1 : reached;
  const span = allowed[index] ?? allowed[0];
  const count = countIn(span, measure);
  const larger = allowed[index - 1];
  const calendar = larger?.unit === 'month' || larger?.unit === 'year';
  const rounded = { ...measure, seconds: count * span.seconds };
  if (larger !== undefined && !calendar && reaches(larger, rounded)) {
    return { count: countIn(larger, measure), unit: larger.unit };
  }
  return { count, unit: span.unit };
}

function allowedUnits({ minUnit, maxUnit }: RelativeOptions): readonly [UnitSpan, ...UnitSpan[]] {
  const first = Math.max(
    LARGEST_FIRST.findIndex(({ unit }) => unit === maxUnit),
    0
  );
  const last = LARGEST_FIRST.findIndex(({ unit }) => unit === minUnit);
  const allowed = LARGEST_FIRST.slice(first, last === -1 ? undefined : last + 1);
  return [allowed[0] ?? LARGEST_FIRST[0], ...allowed.slice(1)];
}

export const relative = defineKind({
  name: 'relative',
  arg: isString,
  options: optionKeys<RelativeOptions>(RELATIVE_OPTION_KEYS),
  render: (value, options, context) => {
    const { pastOnly = false, now: pinned, thresholds = {}, ...rest } = options ?? {};
    const { minUnit, maxUnit, ...display } = rest;
    return andThen(parseInstant('relative', value), (then) =>
      andThen(referenceInstant('relative', pinned, context), (now) =>
        andThen(calendarMonthsBetween(now, then, context), (rawMonths) =>
          map(
            context.cache.relativeTimeFormat(context.locale, { numeric: 'auto', ...display }),
            (format) => {
              const signed = (then.getTime() - now.getTime()) / MILLISECONDS_PER_SECOND;
              const pastward = pastOnly && signed > 0;
              const measure = {
                seconds: pastward ? 0 : signed,
                months: pastward ? 0 : rawMonths,
                thresholds,
              };
              const { count, unit } = inLargestUnit(measure, allowedUnits({ minUnit, maxUnit }));
              return format.format(count, unit);
            }
          )
        )
      )
    );
  },
});

/** @public */
export type RelativeValue = TaggedOf<typeof relative>;
