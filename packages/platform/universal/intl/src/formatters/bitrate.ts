import { andThen, map } from '@kit/result';
import { finite, isNumber } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';
import { scale } from './bytes';

const BITRATE_OPTION_KEYS = [
  'maximumFractionDigits',
  'unitDisplay',
] as const satisfies OptionKeys<Intl.NumberFormatOptions>;

type BitrateOptions = Pick<Intl.NumberFormatOptions, (typeof BITRATE_OPTION_KEYS)[number]>;

const BITRATE_UNITS = [
  'bit-per-second',
  'kilobit-per-second',
  'megabit-per-second',
  'gigabit-per-second',
] as const;

/** In bits per second. */
export const bitrate = defineKind({
  name: 'bitrate',
  arg: isNumber,
  options: optionKeys<BitrateOptions>(BITRATE_OPTION_KEYS),
  render: (value, options, context) =>
    andThen(finite('bitrate', value), (bitsPerSecond) => {
      const { amount, unit } = scale(bitsPerSecond, 1000, BITRATE_UNITS);
      const intlOptions = { maximumFractionDigits: 1, ...options, style: 'unit', unit } as const;
      return map(context.cache.numberFormat(context.locale, intlOptions), (format) =>
        format.format(amount)
      );
    }),
});

/** @public */
export type BitrateValue = TaggedOf<typeof bitrate>;
