import { andThen, map } from '@vp/result';
import { finite } from '../inputs';
import { type OptionKeys, withOptions } from '../with-options';

export const NUMBER_OPTION_KEYS = [
  'minimumFractionDigits',
  'maximumFractionDigits',
  'minimumIntegerDigits',
  'useGrouping',
  'signDisplay',
  'notation',
  'compactDisplay',
  'unit',
  'unitDisplay',
] as const satisfies OptionKeys<Intl.NumberFormatOptions>;

export type NumberOptions = Pick<Intl.NumberFormatOptions, (typeof NUMBER_OPTION_KEYS)[number]>;

export interface NumberValue {
  readonly type: 'number';
  readonly value: number;
  readonly options?: NumberOptions;
}

export function numberFormatOptions(options: NumberOptions = {}): Intl.NumberFormatOptions {
  return { ...options, style: options.unit === undefined ? 'decimal' : 'unit' };
}

export const number = withOptions<NumberValue>('number', NUMBER_OPTION_KEYS, (value, context) =>
  andThen(finite('number', value.value), (finiteValue) =>
    map(context.cache.numberFormat(context.locale, numberFormatOptions(value.options)), (format) =>
      format.format(finiteValue)
    )
  )
);
