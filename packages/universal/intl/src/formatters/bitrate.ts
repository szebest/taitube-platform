import { andThen, map } from '@vp/result';
import { finite } from '../inputs';
import { type OptionKeys, withOptions } from '../with-options';
import { scale } from './bytes';

export const BITRATE_OPTION_KEYS = [
  'maximumFractionDigits',
  'unitDisplay',
] as const satisfies OptionKeys<Intl.NumberFormatOptions>;

export type BitrateOptions = Pick<Intl.NumberFormatOptions, (typeof BITRATE_OPTION_KEYS)[number]>;

/** In bits per second. */
export interface BitrateValue {
  readonly type: 'bitrate';
  readonly value: number;
  readonly options?: BitrateOptions;
}

const BITRATE_UNITS = [
  'bit-per-second',
  'kilobit-per-second',
  'megabit-per-second',
  'gigabit-per-second',
] as const;

export const bitrate = withOptions<BitrateValue>('bitrate', BITRATE_OPTION_KEYS, (value, context) =>
  andThen(finite('bitrate', value.value), (bitsPerSecond) => {
    const { amount, unit } = scale(bitsPerSecond, 1000, BITRATE_UNITS);
    const options = { maximumFractionDigits: 1, ...value.options, style: 'unit', unit } as const;
    return map(context.cache.numberFormat(context.locale, options), (format) =>
      format.format(amount)
    );
  })
);
