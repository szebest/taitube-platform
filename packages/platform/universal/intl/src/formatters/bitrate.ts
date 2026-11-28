import { type OptionKeys, type TaggedOf } from '../kind';
import { defineScaledUnitKind } from '../number-kind';

const BITRATE_OPTION_KEYS = [
  'minimumFractionDigits',
  'maximumFractionDigits',
  'roundingMode',
  'unitDisplay',
  'minUnit',
] as const satisfies OptionKeys<Intl.NumberFormatOptions, 'minUnit'>;

const BITRATE_UNITS = [
  'bit-per-second',
  'kilobit-per-second',
  'megabit-per-second',
  'gigabit-per-second',
] as const;

type BitrateOptions = Pick<
  Intl.NumberFormatOptions,
  'minimumFractionDigits' | 'maximumFractionDigits' | 'roundingMode' | 'unitDisplay'
> & { readonly minUnit?: (typeof BITRATE_UNITS)[number] };

/** In bits per second. */
export const bitrate = defineScaledUnitKind({
  name: 'bitrate',
  keys: BITRATE_OPTION_KEYS,
  units: BITRATE_UNITS,
  scaleBy: (display: Omit<Partial<BitrateOptions>, 'minUnit'>) => ({ step: 1000, display }),
});

/** @public */
export type BitrateValue = TaggedOf<typeof bitrate>;
