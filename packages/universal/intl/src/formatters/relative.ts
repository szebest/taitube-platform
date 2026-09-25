import { andThen, map } from '@vp/result';
import { parseInstant } from '../inputs';
import { referenceInstant } from '../reference-instant';
import { type OptionKeys, withOptions } from '../with-options';

export const RELATIVE_OPTION_KEYS = [
  'numeric',
  'style',
] as const satisfies OptionKeys<Intl.RelativeTimeFormatOptions>;

export type RelativeOptions = Pick<
  Intl.RelativeTimeFormatOptions,
  (typeof RELATIVE_OPTION_KEYS)[number]
>;

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

const SECOND: UnitSpan = { unit: 'second', seconds: 1 };

const LARGEST_FIRST: readonly UnitSpan[] = [
  { unit: 'year', seconds: 365 * 24 * 60 * 60 },
  { unit: 'month', seconds: 30 * 24 * 60 * 60 },
  { unit: 'week', seconds: 7 * 24 * 60 * 60 },
  { unit: 'day', seconds: 24 * 60 * 60 },
  { unit: 'hour', seconds: 60 * 60 },
  { unit: 'minute', seconds: 60 },
  SECOND,
];

export function largestUnit(elapsedSeconds: number): UnitSpan {
  return LARGEST_FIRST.find(({ seconds }) => Math.abs(elapsedSeconds) >= seconds) ?? SECOND;
}

export const relative = withOptions<RelativeValue>(
  'relative',
  RELATIVE_OPTION_KEYS,
  (value, context) =>
    andThen(parseInstant('relative', value.value), (then) =>
      andThen(referenceInstant('relative', value.now, context), (now) => {
        const options = { numeric: 'auto' as const, ...value.options };
        return map(context.cache.relativeTimeFormat(context.locale, options), (format) => {
          const elapsedSeconds = (then.getTime() - now.getTime()) / 1000;
          const { unit, seconds } = largestUnit(elapsedSeconds);
          return format.format(Math.round(elapsedSeconds / seconds), unit);
        });
      })
    )
);
