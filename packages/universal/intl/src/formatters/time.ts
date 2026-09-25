import { type DateStyle, formatInstant } from '../format-instant';
import { type OptionKeys, withOptions } from '../with-options';

export const TIME_FIELD_KEYS = [
  'hour',
  'minute',
  'second',
  'hour12',
  'hourCycle',
  'timeZoneName',
] as const satisfies OptionKeys<Intl.DateTimeFormatOptions>;

export const TIME_OPTION_KEYS = ['style', ...TIME_FIELD_KEYS] as const satisfies OptionKeys<
  Intl.DateTimeFormatOptions,
  'style'
>;

export type TimeOptions = Pick<Intl.DateTimeFormatOptions, (typeof TIME_FIELD_KEYS)[number]> & {
  readonly style?: DateStyle;
};

export interface TimeValue {
  readonly type: 'time';
  readonly value: string;
  readonly options?: TimeOptions;
}

export function timeFormatOptions(options: TimeOptions = {}): Intl.DateTimeFormatOptions {
  const { style, ...fields } = options;
  if (style !== undefined) return { timeStyle: style };
  return Object.keys(fields).length === 0 ? { timeStyle: 'short' } : fields;
}

export const time = withOptions<TimeValue>('time', TIME_OPTION_KEYS, (value, context) =>
  formatInstant('time', value.value, timeFormatOptions(value.options), context)
);
