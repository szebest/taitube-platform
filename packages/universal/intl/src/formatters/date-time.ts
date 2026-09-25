import { type DateStyle, formatInstant } from '../format-instant';
import { type OptionKeys, withOptions } from '../with-options';
import { DATE_FIELD_KEYS } from './date';
import { TIME_FIELD_KEYS } from './time';

const DATE_TIME_FIELD_KEYS = [
  ...DATE_FIELD_KEYS,
  ...TIME_FIELD_KEYS,
] as const satisfies OptionKeys<Intl.DateTimeFormatOptions>;

const DATE_TIME_OPTION_KEYS = ['style', ...DATE_TIME_FIELD_KEYS] as const satisfies OptionKeys<
  Intl.DateTimeFormatOptions,
  'style'
>;

type DateTimeOptions = Pick<Intl.DateTimeFormatOptions, (typeof DATE_TIME_FIELD_KEYS)[number]> & {
  readonly style?: DateStyle;
};

export interface DateTimeValue {
  readonly type: 'dateTime';
  readonly value: string;
  readonly options?: DateTimeOptions;
}

function dateTimeFormatOptions(options: DateTimeOptions = {}): Intl.DateTimeFormatOptions {
  const { style, ...fields } = options;
  if (style !== undefined) return { dateStyle: style, timeStyle: 'short' };
  return Object.keys(fields).length === 0 ? { dateStyle: 'medium', timeStyle: 'short' } : fields;
}

export const dateTime = withOptions<DateTimeValue>(
  'dateTime',
  DATE_TIME_OPTION_KEYS,
  (value, context) =>
    formatInstant('dateTime', value.value, dateTimeFormatOptions(value.options), context)
);
