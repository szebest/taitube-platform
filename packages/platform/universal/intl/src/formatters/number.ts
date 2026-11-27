import { ok } from '@kit/result';
import { type OptionKeys, type TaggedOf } from '../kind';
import { defineNumberKind } from '../number-kind';

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

export const number = defineNumberKind({
  name: 'number',
  keys: NUMBER_OPTION_KEYS,
  transform: (amount, options: Partial<NumberOptions>) =>
    ok({ amount, format: numberFormatOptions(options) }),
});

/** @public */
export type NumberValue = TaggedOf<typeof number>;
