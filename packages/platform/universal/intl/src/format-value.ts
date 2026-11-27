import { bitrate } from './formatters/bitrate';
import { bytes } from './formatters/bytes';
import { calendarDay } from './formatters/calendar-day';
import { collator } from './formatters/collator';
import { compact } from './formatters/compact';
import { date } from './formatters/date';
import { dateRange } from './formatters/date-range';
import { dateTime } from './formatters/date-time';
import { displayName } from './formatters/display-name';
import { duration } from './formatters/duration';
import { list } from './formatters/list';
import { money } from './formatters/money';
import { number } from './formatters/number';
import { numberRange } from './formatters/number-range';
import { percent } from './formatters/percent';
import { pluralCategory } from './formatters/plural';
import { relative } from './formatters/relative';
import { time } from './formatters/time';
import { truncate } from './formatters/truncate';
import type { Kind, TaggedOf } from './kind';

/** Every kind this package ships; an app passes `[...formatKinds, ...its own]` to `createIntl`. */
export const formatKinds = [
  compact,
  number,
  percent,
  bytes,
  bitrate,
  numberRange,
  money,
  date,
  time,
  dateTime,
  dateRange,
  relative,
  calendarDay,
  duration,
  list,
  displayName,
  collator,
  pluralCategory,
  truncate,
] as const;

export type FormatKinds = typeof formatKinds;

/**
 * The tagged values a registry can render as text, one member per text kind, derived from it.
 * @public
 */
export type TaggedValueOf<Kinds extends readonly Kind[]> = TaggedOf<Kinds[number]>;

/** @public */
export type TaggedValue = TaggedValueOf<FormatKinds>;

/** What a placeholder may hold: text as authored, a bare number, or a value tagged with its kind. */
export type FormatValueOf<Kinds extends readonly Kind[]> = string | number | TaggedValueOf<Kinds>;

export type FormatValue = FormatValueOf<FormatKinds>;
