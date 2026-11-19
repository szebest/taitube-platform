import { type DateStyle, formatInstant } from '../format-instant';
import { type OptionKeys, withOptions } from '../with-options';

export const DATE_FIELD_KEYS = [
  'weekday',
  'era',
  'year',
  'month',
  'day',
  'timeZoneName',
] as const satisfies OptionKeys<Intl.DateTimeFormatOptions>;

export const DATE_OPTION_KEYS = ['style', ...DATE_FIELD_KEYS] as const satisfies OptionKeys<
  Intl.DateTimeFormatOptions,
  'style'
>;

export type DateOptions = Pick<Intl.DateTimeFormatOptions, (typeof DATE_FIELD_KEYS)[number]> & {
  readonly style?: DateStyle;
};

/** An ISO 8601 instant. */
export interface DateValue {
  readonly type: 'date';
  readonly value: string;
  readonly options?: DateOptions;
}

export function dateFormatOptions(options: DateOptions = {}): Intl.DateTimeFormatOptions {
  const { style, ...fields } = options;
  if (style !== undefined) return { dateStyle: style };
  return Object.keys(fields).length === 0 ? { dateStyle: 'medium' } : fields;
}

export const date = withOptions<DateValue>('date', DATE_OPTION_KEYS, (value, context) =>
  formatInstant('date', value.value, dateFormatOptions(value.options), context)
);
