import { andThen, map } from '@kit/result';
import { parseInstant } from '../inputs';
import { type TaggedOf, defineKind, optionKeys } from '../kind';
import { DATE_OPTION_KEYS, type DateOptions, dateFormatOptions } from './date';

const isStringPair = (value: unknown): value is readonly [string, string] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((end: unknown) => typeof end === 'string');

export const dateRange = defineKind({
  name: 'dateRange',
  arg: isStringPair,
  options: optionKeys<DateOptions>(DATE_OPTION_KEYS),
  render: ([start, end], options, context) => {
    const intlOptions = { ...dateFormatOptions(options), timeZone: context.timeZone };
    return andThen(parseInstant('dateRange', start), (from) =>
      andThen(parseInstant('dateRange', end), (to) =>
        map(context.cache.dateTimeFormat(context.locale, intlOptions), (format) =>
          format.formatRange(from, to)
        )
      )
    );
  },
});

/** @public */
export type DateRangeValue = TaggedOf<typeof dateRange>;
