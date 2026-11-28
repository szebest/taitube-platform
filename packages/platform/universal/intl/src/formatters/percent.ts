import { ok } from '@kit/result';
import { type OptionKeys, type TaggedOf } from '../kind';
import { defineNumberKind } from '../number-kind';

const PERCENT_OPTION_KEYS = [
  'minimumFractionDigits',
  'maximumFractionDigits',
  'maximumSignificantDigits',
  'roundingMode',
  'signDisplay',
  'input',
] as const satisfies OptionKeys<Intl.NumberFormatOptions, 'input'>;

type PercentOptions = Pick<
  Intl.NumberFormatOptions,
  Exclude<(typeof PERCENT_OPTION_KEYS)[number], 'input'>
> & { readonly input?: 'points' | 'fraction' };

/** In percentage points, `7` rendering as 7%, not 700%; `input: 'fraction'` reads `0.07` as 7%. */
export const percent = defineNumberKind({
  name: 'percent',
  keys: PERCENT_OPTION_KEYS,
  defaults: { maximumFractionDigits: 1 },
  transform: (value, { input = 'points', ...display }: Partial<PercentOptions>) =>
    ok({
      amount: input === 'points' ? value / 100 : value,
      format: { ...display, style: 'percent' },
    }),
});

/** @public */
export type PercentValue = TaggedOf<typeof percent>;
