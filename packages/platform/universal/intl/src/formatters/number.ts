import { andThen, map } from '@kit/result';
import { finite, isNumber } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';

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

export function numberFormatOptions(options: NumberOptions = {}): Intl.NumberFormatOptions {
  return { ...options, style: options.unit === undefined ? 'decimal' : 'unit' };
}

export const number = defineKind({
  name: 'number',
  arg: isNumber,
  options: optionKeys<NumberOptions>(NUMBER_OPTION_KEYS),
  render: (value, options, context) =>
    andThen(finite('number', value), (finiteValue) =>
      map(context.cache.numberFormat(context.locale, numberFormatOptions(options)), (format) =>
        format.format(finiteValue)
      )
    ),
});

/** @public */
export type NumberValue = TaggedOf<typeof number>;
