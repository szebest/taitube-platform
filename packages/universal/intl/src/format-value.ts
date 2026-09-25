import { type Result, assertNever, ok } from '@vp/result';
import type { FormatContext } from './context';
import type { FormatFailure } from './failures';
import { type BitrateValue, bitrate } from './formatters/bitrate';
import { type BytesValue, bytes } from './formatters/bytes';
import { type CalendarDayValue, calendarDay } from './formatters/calendar-day';
import { type CountValue, compact } from './formatters/compact';
import { type DateValue, date } from './formatters/date';
import { type DateRangeValue, dateRange } from './formatters/date-range';
import { type DateTimeValue, dateTime } from './formatters/date-time';
import { type DisplayNameValue, displayName } from './formatters/display-name';
import { type DurationValue, duration } from './formatters/duration';
import { type ListValue, list } from './formatters/list';
import { type MoneyValue, money } from './formatters/money';
import { type NumberValue, number } from './formatters/number';
import { type NumberRangeValue, numberRange } from './formatters/number-range';
import { type PercentValue, percent } from './formatters/percent';
import { type RelativeValue, relative } from './formatters/relative';
import { type TimeValue, time } from './formatters/time';

export type TaggedValue =
  | CountValue
  | NumberValue
  | PercentValue
  | BytesValue
  | BitrateValue
  | NumberRangeValue
  | MoneyValue
  | DateValue
  | TimeValue
  | DateTimeValue
  | DateRangeValue
  | RelativeValue
  | CalendarDayValue
  | DurationValue
  | ListValue
  | DisplayNameValue;

/** What a placeholder may hold: text as authored, a bare number, or a value tagged with its kind. */
export type FormatValue = string | number | TaggedValue;

export const FORMAT_KINDS = [
  'count',
  'number',
  'percent',
  'bytes',
  'bitrate',
  'numberRange',
  'money',
  'date',
  'time',
  'dateTime',
  'dateRange',
  'relative',
  'calendarDay',
  'duration',
  'list',
  'displayName',
] as const;

export type FormatKind = (typeof FORMAT_KINDS)[number];

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * Compiles only while `Kinds` and the union's tags are the same set, each way round.
 * @public
 */
export type KindsMatchUnion<Kinds extends string, Tags extends string> = Same<
  Kinds,
  Tags
> extends true
  ? true
  : never;

export const KINDS_MATCH_UNION: KindsMatchUnion<FormatKind, TaggedValue['type']> = true;

export function formatValue(
  value: FormatValue,
  context: FormatContext
): Result<string, FormatFailure> {
  if (typeof value === 'string') return ok(value);
  if (typeof value === 'number') return number({ type: 'number', value }, context);
  switch (value.type) {
    case 'count':
      return compact(value, context);
    case 'number':
      return number(value, context);
    case 'percent':
      return percent(value, context);
    case 'bytes':
      return bytes(value, context);
    case 'bitrate':
      return bitrate(value, context);
    case 'numberRange':
      return numberRange(value, context);
    case 'money':
      return money(value, context);
    case 'date':
      return date(value, context);
    case 'time':
      return time(value, context);
    case 'dateTime':
      return dateTime(value, context);
    case 'dateRange':
      return dateRange(value, context);
    case 'relative':
      return relative(value, context);
    case 'calendarDay':
      return calendarDay(value, context);
    case 'duration':
      return duration(value, context);
    case 'list':
      return list(value, context);
    case 'displayName':
      return displayName(value, context);
    default:
      return assertNever(value, 'formatValue');
  }
}
