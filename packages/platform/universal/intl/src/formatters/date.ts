import { type DateStyle, formatInstant } from '../format-instant';
import { isString } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';

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

export function dateFormatOptions(options: DateOptions = {}): Intl.DateTimeFormatOptions {
  const { style, ...fields } = options;
  if (style !== undefined) return { dateStyle: style };
  return Object.keys(fields).length === 0 ? { dateStyle: 'medium' } : fields;
}

/** An ISO 8601 instant. */
export const date = defineKind({
  name: 'date',
  arg: isString,
  options: optionKeys<DateOptions>(DATE_OPTION_KEYS),
  render: (value, options, context) =>
    formatInstant('date', value, dateFormatOptions(options), context),
});

/** @public */
export type DateValue = TaggedOf<typeof date>;
