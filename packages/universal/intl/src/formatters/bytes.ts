import { andThen, map } from '@vp/result';
import { finite } from '../inputs';
import { type OptionKeys, withOptions } from '../with-options';

export const BYTES_OPTION_KEYS = [
  'maximumFractionDigits',
  'unitDisplay',
  'base',
] as const satisfies OptionKeys<Intl.NumberFormatOptions, 'base'>;

export type BytesOptions = Pick<
  Intl.NumberFormatOptions,
  'maximumFractionDigits' | 'unitDisplay'
> & {
  readonly base?: 'decimal' | 'binary';
};

export interface BytesValue {
  readonly type: 'bytes';
  readonly value: number;
  readonly options?: BytesOptions;
}

const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte'] as const;

export interface Scaled<U extends string> {
  readonly amount: number;
  readonly unit: U;
}

/** Divides by `step` until the amount fits the largest unit it reaches, the last unit capping it. */
export function scale<U extends string>(
  value: number,
  step: number,
  units: readonly [U, ...U[]]
): Scaled<U> {
  let amount = value;
  let index = 0;
  while (Math.abs(amount) >= step && index < units.length - 1) {
    amount /= step;
    index += 1;
  }
  return { amount, unit: units[index] ?? units[0] };
}

export const bytes = withOptions<BytesValue>('bytes', BYTES_OPTION_KEYS, (value, context) => {
  const { base = 'decimal', ...display } = value.options ?? {};
  return andThen(finite('bytes', value.value), (count) => {
    const { amount, unit } = scale(count, base === 'binary' ? 1024 : 1000, BYTE_UNITS);
    const options = { maximumFractionDigits: 1, ...display, style: 'unit', unit } as const;
    return map(context.cache.numberFormat(context.locale, options), (format) =>
      format.format(amount)
    );
  });
});
