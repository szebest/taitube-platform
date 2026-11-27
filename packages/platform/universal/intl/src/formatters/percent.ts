import { ok } from '@kit/result';
import { type OptionKeys, type TaggedOf } from '../kind';
import { defineNumberKind } from '../number-kind';

const PERCENT_OPTION_KEYS = [
  'minimumFractionDigits',
  'maximumFractionDigits',
  'signDisplay',
] as const satisfies OptionKeys<Intl.NumberFormatOptions>;

type PercentOptions = Pick<Intl.NumberFormatOptions, (typeof PERCENT_OPTION_KEYS)[number]>;

/** In percentage points: `7` renders as 7%, not 700%. */
export const percent = defineNumberKind({
  name: 'percent',
  keys: PERCENT_OPTION_KEYS,
  defaults: { maximumFractionDigits: 1 },
  transform: (points, options: Partial<PercentOptions>) =>
    ok({ amount: points / 100, format: { ...options, style: 'percent' } }),
});

/** @public */
export type PercentValue = TaggedOf<typeof percent>;
