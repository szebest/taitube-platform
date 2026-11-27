import { type OptionKeys, type TaggedOf } from '../kind';
import { defineScaledUnitKind } from '../number-kind';

const BYTES_OPTION_KEYS = [
  'maximumFractionDigits',
  'unitDisplay',
  'base',
] as const satisfies OptionKeys<Intl.NumberFormatOptions, 'base'>;

type BytesOptions = Pick<
  Intl.NumberFormatOptions,
  Exclude<(typeof BYTES_OPTION_KEYS)[number], 'base'>
> & { readonly base?: 'decimal' | 'binary' };

export const bytes = defineScaledUnitKind({
  name: 'bytes',
  keys: BYTES_OPTION_KEYS,
  units: ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte'],
  scaleBy: ({ base = 'decimal', ...display }: Partial<BytesOptions>) => ({
    step: base === 'binary' ? 1024 : 1000,
    display,
  }),
});

/** @public */
export type BytesValue = TaggedOf<typeof bytes>;
