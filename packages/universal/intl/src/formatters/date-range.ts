import { andThen, map } from '@vp/result';
import { parseInstant } from '../inputs';
import { withOptions } from '../with-options';
import { DATE_OPTION_KEYS, type DateOptions, dateFormatOptions } from './date';

export interface DateRangeValue {
  readonly type: 'dateRange';
  readonly value: readonly [string, string];
  readonly options?: DateOptions;
}

export const dateRange = withOptions<DateRangeValue>(
  'dateRange',
  DATE_OPTION_KEYS,
  (value, context) => {
    const [start, end] = value.value;
    const options = { ...dateFormatOptions(value.options), timeZone: context.timeZone };
    return andThen(parseInstant('dateRange', start), (from) =>
      andThen(parseInstant('dateRange', end), (to) =>
        map(context.cache.dateTimeFormat(context.locale, options), (format) =>
          format.formatRange(from, to)
        )
      )
    );
  }
);
