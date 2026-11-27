import { ok } from '@kit/result';
import { type OptionKeys, type TaggedOf } from '../kind';
import { defineNumberKind } from '../number-kind';

const COMPACT_OPTION_KEYS = [
  'compactDisplay',
  'maximumFractionDigits',
  'minimumFractionDigits',
  'maximumSignificantDigits',
  'roundingMode',
  'signDisplay',
] as const satisfies OptionKeys<Intl.NumberFormatOptions>;

type CompactOptions = Pick<Intl.NumberFormatOptions, (typeof COMPACT_OPTION_KEYS)[number]>;

export const compact = defineNumberKind({
  name: 'count',
  keys: COMPACT_OPTION_KEYS,
  transform: (amount, options: Partial<CompactOptions>) =>
    ok({ amount, format: { ...options, notation: 'compact' } }),
});

/** @public */
export type CountValue = TaggedOf<typeof compact>;
