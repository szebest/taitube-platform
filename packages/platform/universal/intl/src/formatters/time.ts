import { type DateStyle, formatInstant, resolveDateOptions } from '../format-instant';
import { isString } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';

export const TIME_FIELD_KEYS = [
  'hour',
  'minute',
  'second',
  'hour12',
  'hourCycle',
  'fractionalSecondDigits',
  'timeZoneName',
  'timeZone',
] as const satisfies OptionKeys<Intl.DateTimeFormatOptions>;

const TIME_OPTION_KEYS = ['style', ...TIME_FIELD_KEYS] as const satisfies OptionKeys<
  Intl.DateTimeFormatOptions,
  'style'
>;

type TimeOptions = Pick<Intl.DateTimeFormatOptions, (typeof TIME_FIELD_KEYS)[number]> & {
  readonly style?: DateStyle;
};

const TIME_RESOLUTION = { styleKey: 'timeStyle', defaults: { timeStyle: 'short' } } as const;

export const time = defineKind({
  name: 'time',
  arg: isString,
  options: optionKeys<TimeOptions>(TIME_OPTION_KEYS),
  render: (value, options, context) =>
    formatInstant('time', value, resolveDateOptions(options ?? {}, TIME_RESOLUTION), context),
});

/** @public */
export type TimeValue = TaggedOf<typeof time>;
