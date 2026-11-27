import { andThen, map } from '@kit/result';
import { finite, isNumber } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';

const PERCENT_OPTION_KEYS = [
  'minimumFractionDigits',
  'maximumFractionDigits',
  'signDisplay',
] as const satisfies OptionKeys<Intl.NumberFormatOptions>;

type PercentOptions = Pick<Intl.NumberFormatOptions, (typeof PERCENT_OPTION_KEYS)[number]>;

/** In percentage points: `7` renders as 7%, not 700%. */
export const percent = defineKind({
  name: 'percent',
  arg: isNumber,
  options: optionKeys<PercentOptions>(PERCENT_OPTION_KEYS),
  render: (value, options, context) =>
    andThen(finite('percent', value), (points) =>
      map(
        context.cache.numberFormat(context.locale, {
          maximumFractionDigits: 1,
          ...options,
          style: 'percent',
        }),
        (format) => format.format(points / 100)
      )
    ),
});

/** @public */
export type PercentValue = TaggedOf<typeof percent>;
