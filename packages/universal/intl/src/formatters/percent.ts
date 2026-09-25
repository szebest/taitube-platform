import { andThen, map } from '@vp/result';
import { finite } from '../inputs';
import { type OptionKeys, withOptions } from '../with-options';

const PERCENT_OPTION_KEYS = [
  'minimumFractionDigits',
  'maximumFractionDigits',
  'signDisplay',
] as const satisfies OptionKeys<Intl.NumberFormatOptions>;

type PercentOptions = Pick<Intl.NumberFormatOptions, (typeof PERCENT_OPTION_KEYS)[number]>;

/** In percentage points: `7` renders as 7%, not 700%. */
export interface PercentValue {
  readonly type: 'percent';
  readonly value: number;
  readonly options?: PercentOptions;
}

export const percent = withOptions<PercentValue>('percent', PERCENT_OPTION_KEYS, (value, context) =>
  andThen(finite('percent', value.value), (points) =>
    map(
      context.cache.numberFormat(context.locale, {
        maximumFractionDigits: 1,
        ...value.options,
        style: 'percent',
      }),
      (format) => format.format(points / 100)
    )
  )
);
