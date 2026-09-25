import { andThen, map } from '@vp/result';
import { finite } from '../inputs';
import { type OptionKeys, withOptions } from '../with-options';

const COMPACT_OPTION_KEYS = [
  'compactDisplay',
  'maximumFractionDigits',
  'minimumFractionDigits',
  'maximumSignificantDigits',
] as const satisfies OptionKeys<Intl.NumberFormatOptions>;

type CompactOptions = Pick<Intl.NumberFormatOptions, (typeof COMPACT_OPTION_KEYS)[number]>;

export interface CountValue {
  readonly type: 'count';
  readonly value: number;
  readonly options?: CompactOptions;
}

export const compact = withOptions<CountValue>('compact', COMPACT_OPTION_KEYS, (value, context) =>
  andThen(finite('compact', value.value), (count) =>
    map(
      context.cache.numberFormat(context.locale, { ...value.options, notation: 'compact' }),
      (format) => format.format(count)
    )
  )
);
