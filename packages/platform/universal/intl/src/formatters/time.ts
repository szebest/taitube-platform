import { type DateStyle, formatInstant } from '../format-instant';
import { isString } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';

export const TIME_FIELD_KEYS = [
  'hour',
  'minute',
  'second',
  'hour12',
  'hourCycle',
  'timeZoneName',
] as const satisfies OptionKeys<Intl.DateTimeFormatOptions>;

const TIME_OPTION_KEYS = ['style', ...TIME_FIELD_KEYS] as const satisfies OptionKeys<
  Intl.DateTimeFormatOptions,
  'style'
>;

type TimeOptions = Pick<Intl.DateTimeFormatOptions, (typeof TIME_FIELD_KEYS)[number]> & {
  readonly style?: DateStyle;
};

function timeFormatOptions(options: TimeOptions = {}): Intl.DateTimeFormatOptions {
  const { style, ...fields } = options;
  if (style !== undefined) return { timeStyle: style };
  return Object.keys(fields).length === 0 ? { timeStyle: 'short' } : fields;
}

export const time = defineKind({
  name: 'time',
  arg: isString,
  options: optionKeys<TimeOptions>(TIME_OPTION_KEYS),
  render: (value, options, context) =>
    formatInstant('time', value, timeFormatOptions(options), context),
});

/** @public */
export type TimeValue = TaggedOf<typeof time>;
