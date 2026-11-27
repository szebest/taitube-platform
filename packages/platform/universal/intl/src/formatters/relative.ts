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

const SMALLEST: UnitSpan = { unit: 'second', seconds: SECOND };

const LARGEST_FIRST: readonly UnitSpan[] = [
  { unit: 'year', seconds: YEAR },
  { unit: 'month', seconds: MONTH },
  { unit: 'week', seconds: WEEK },
  { unit: 'day', seconds: DAY },
  { unit: 'hour', seconds: HOUR },
  { unit: 'minute', seconds: MINUTE },
  SMALLEST,
];

function largestUnit(elapsedSeconds: number): UnitSpan {
  return LARGEST_FIRST.find(({ seconds }) => Math.abs(elapsedSeconds) >= seconds) ?? SMALLEST;
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
          const { unit, seconds } = largestUnit(elapsedSeconds);
          return format.format(Math.round(elapsedSeconds / seconds), unit);
        });
      })
    );
  },
});

/** @public */
export type RelativeValue = TaggedOf<typeof relative>;
