import { andThen, map } from '@vp/result';
import { parseInstant } from '../inputs';
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
import { type OptionKeys, withOptions } from '../with-options';

const RELATIVE_OPTION_KEYS = ['numeric', 'style', 'pastOnly'] as const satisfies OptionKeys<
  Intl.RelativeTimeFormatOptions,
  'pastOnly'
>;

/** `pastOnly` reads an instant after the reference as `now`: a publish date is never in the future. */
type RelativeOptions = Pick<
  Intl.RelativeTimeFormatOptions,
  Exclude<(typeof RELATIVE_OPTION_KEYS)[number], 'pastOnly'>
> & { readonly pastOnly?: boolean };

export interface RelativeValue {
  readonly type: 'relative';
  readonly value: string;
  readonly now?: string;
  readonly options?: RelativeOptions;
}

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

export const relative = withOptions<RelativeValue>(
  'relative',
  RELATIVE_OPTION_KEYS,
  (value, context) =>
    andThen(parseInstant('relative', value.value), (then) =>
      andThen(referenceInstant('relative', value.now, context), (now) => {
        const { pastOnly = false, ...display } = value.options ?? {};
        const options = { numeric: 'auto' as const, ...display };
        return map(context.cache.relativeTimeFormat(context.locale, options), (format) => {
          const signedSeconds = (then.getTime() - now.getTime()) / MILLISECONDS_PER_SECOND;
          const elapsedSeconds = pastOnly ? Math.min(signedSeconds, 0) : signedSeconds;
          const { unit, seconds } = largestUnit(elapsedSeconds);
          return format.format(Math.round(elapsedSeconds / seconds), unit);
        });
      })
    )
);
