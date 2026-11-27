import { andThen, map } from '@kit/result';
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

const RELATIVE_OPTION_KEYS = ['numeric', 'style', 'pastOnly', 'now'] as const satisfies OptionKeys<
  Intl.RelativeTimeFormatOptions,
  'pastOnly' | 'now'
>;

/**
 * `now` is the instant measured from, else the context's. `pastOnly` reads an instant after it
 * as `now`: a publish date is never in the future.
 */
type RelativeOptions = Pick<Intl.RelativeTimeFormatOptions, 'numeric' | 'style'> & {
  readonly pastOnly?: boolean;
  readonly now?: string;
};

interface UnitSpan {
  readonly unit: Intl.RelativeTimeFormatUnit;
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

const roundHalfAwayFromZero = (value: number) => Math.sign(value) * Math.round(Math.abs(value));

interface Elapsed {
  readonly count: number;
  readonly unit: Intl.RelativeTimeFormatUnit;
}

/**
 * The largest unit the span reaches, rounded the same way either side of now; a count that
 * rounds up to the next unit (59.5 minutes) is read in that unit (1 hour), never as 60 minutes.
 */
function inLargestUnit(elapsedSeconds: number): Elapsed {
  const reached = LARGEST_FIRST.findIndex(({ seconds }) => Math.abs(elapsedSeconds) >= seconds);
  const index = reached === -1 ? LARGEST_FIRST.length - 1 : reached;
  const span = LARGEST_FIRST[index] ?? LARGEST_FIRST[0];
  const count = roundHalfAwayFromZero(elapsedSeconds / span.seconds);
  const larger = LARGEST_FIRST[index - 1];
  if (larger !== undefined && Math.abs(count) * span.seconds >= larger.seconds) {
    return { count: roundHalfAwayFromZero(elapsedSeconds / larger.seconds), unit: larger.unit };
  }
  return { count, unit: span.unit };
}

export const relative = defineKind({
  name: 'relative',
  arg: isString,
  options: optionKeys<RelativeOptions>(RELATIVE_OPTION_KEYS),
  render: (value, options, context) => {
    const { pastOnly = false, now: pinned, ...display } = options ?? {};
    return andThen(parseInstant('relative', value), (then) =>
      andThen(referenceInstant('relative', pinned, context), (now) => {
        const intlOptions = { numeric: 'auto' as const, ...display };
        return map(context.cache.relativeTimeFormat(context.locale, intlOptions), (format) => {
          const signedSeconds = (then.getTime() - now.getTime()) / MILLISECONDS_PER_SECOND;
          const elapsedSeconds = pastOnly ? Math.min(signedSeconds, 0) : signedSeconds;
          const { count, unit } = inLargestUnit(elapsedSeconds);
          return format.format(count, unit);
        });
      })
    );
  },
});

/** @public */
export type RelativeValue = TaggedOf<typeof relative>;
