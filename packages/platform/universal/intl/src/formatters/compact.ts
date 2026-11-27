import { andThen, map } from '@kit/result';
import { finite, isNumber } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';

const COMPACT_OPTION_KEYS = [
  'compactDisplay',
  'maximumFractionDigits',
  'minimumFractionDigits',
  'maximumSignificantDigits',
] as const satisfies OptionKeys<Intl.NumberFormatOptions>;

type CompactOptions = Pick<Intl.NumberFormatOptions, (typeof COMPACT_OPTION_KEYS)[number]>;

export const compact = defineKind({
  name: 'count',
  arg: isNumber,
  options: optionKeys<CompactOptions>(COMPACT_OPTION_KEYS),
  render: (value, options, context) =>
    andThen(finite('compact', value), (count) =>
      map(
        context.cache.numberFormat(context.locale, { ...options, notation: 'compact' }),
        (format) => format.format(count)
      )
    ),
});

/** @public */
export type CountValue = TaggedOf<typeof compact>;
