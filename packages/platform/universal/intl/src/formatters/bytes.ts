import { type OptionKeys, type TaggedOf } from '../kind';
import { defineScaledUnitKind } from '../number-kind';

const BYTES_OPTION_KEYS = [
  'minimumFractionDigits',
  'maximumFractionDigits',
  'roundingMode',
  'unitDisplay',
  'base',
  'minUnit',
] as const satisfies OptionKeys<Intl.NumberFormatOptions, 'base' | 'minUnit'>;

const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte'] as const;

/** `minUnit: 'kilobyte'` never shows a size below one, so `512` is `0.5 KB`. */
type BytesOptions = Pick<
  Intl.NumberFormatOptions,
  'minimumFractionDigits' | 'maximumFractionDigits' | 'roundingMode' | 'unitDisplay'
> & { readonly base?: 'decimal' | 'binary'; readonly minUnit?: (typeof BYTE_UNITS)[number] };

export const bytes = defineScaledUnitKind({
  name: 'bytes',
  keys: BYTES_OPTION_KEYS,
  units: BYTE_UNITS,
  scaleBy: ({ base = 'decimal', ...display }: Omit<Partial<BytesOptions>, 'minUnit'>) => ({
    step: base === 'binary' ? 1024 : 1000,
    display,
  }),
});

/** @public */
export type BytesValue = TaggedOf<typeof bytes>;
