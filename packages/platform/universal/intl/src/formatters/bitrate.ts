import { type OptionKeys, type TaggedOf } from '../kind';
import { defineScaledUnitKind } from '../number-kind';

const BITRATE_OPTION_KEYS = [
  'maximumFractionDigits',
  'unitDisplay',
] as const satisfies OptionKeys<Intl.NumberFormatOptions>;

type BitrateOptions = Pick<Intl.NumberFormatOptions, (typeof BITRATE_OPTION_KEYS)[number]>;

/** In bits per second. */
export const bitrate = defineScaledUnitKind({
  name: 'bitrate',
  keys: BITRATE_OPTION_KEYS,
  units: ['bit-per-second', 'kilobit-per-second', 'megabit-per-second', 'gigabit-per-second'],
  scaleBy: (display: Partial<BitrateOptions>) => ({ step: 1000, display }),
});

/** @public */
export type BitrateValue = TaggedOf<typeof bitrate>;
