import { type DateStyle, formatInstant, resolveDateOptions } from '../format-instant';
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

const DATE_TIME_RESOLUTION = {
  styleKey: 'dateStyle',
  defaults: { dateStyle: 'medium', timeStyle: 'short' },
} as const;

export const dateTime = defineKind({
  name: 'dateTime',
  arg: isString,
  options: optionKeys<DateTimeOptions>(DATE_TIME_OPTION_KEYS),
  render: (value, options, context) =>
    formatInstant(
      'dateTime',
      value,
      resolveDateOptions(options ?? {}, DATE_TIME_RESOLUTION),
      context
    ),
});

/** @public */
export type DateTimeValue = TaggedOf<typeof dateTime>;
