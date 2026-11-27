import { type DateStyle, formatInstant } from '../format-instant';
import { isString } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';
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

function dateTimeFormatOptions(options: DateTimeOptions = {}): Intl.DateTimeFormatOptions {
  const { style, ...fields } = options;
  if (style !== undefined) return { dateStyle: style, timeStyle: 'short' };
  return Object.keys(fields).length === 0 ? { dateStyle: 'medium', timeStyle: 'short' } : fields;
}

export const dateTime = defineKind({
  name: 'dateTime',
  arg: isString,
  options: optionKeys<DateTimeOptions>(DATE_TIME_OPTION_KEYS),
  render: (value, options, context) =>
    formatInstant('dateTime', value, dateTimeFormatOptions(options), context),
});

/** @public */
export type DateTimeValue = TaggedOf<typeof dateTime>;
