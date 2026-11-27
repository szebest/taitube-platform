import {
  DATE_RESOLUTION,
  INSTANT_KEYS,
  type DateStyle,
  formatInstant,
  resolveDateOptions,
} from '../format-instant';
import { isString } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';

export const DATE_FIELD_KEYS = [
  'weekday',
  'era',
  'year',
  'month',
  'day',
  'timeZoneName',
  ...INSTANT_KEYS,
] as const satisfies OptionKeys<Intl.DateTimeFormatOptions>;

const DATE_OPTION_KEYS = ['style', ...DATE_FIELD_KEYS] as const satisfies OptionKeys<
  Intl.DateTimeFormatOptions,
  'style'
>;

export type DateOptions = Pick<Intl.DateTimeFormatOptions, (typeof DATE_FIELD_KEYS)[number]> & {
  readonly style?: DateStyle;
};

/** An ISO 8601 instant. */
export const date = defineKind({
  name: 'date',
  arg: isString,
  options: optionKeys<DateOptions>(DATE_OPTION_KEYS),
  render: (value, options, context) =>
    formatInstant('date', value, resolveDateOptions(options ?? {}, DATE_RESOLUTION), context),
});

/** @public */
export type DateValue = TaggedOf<typeof date>;
