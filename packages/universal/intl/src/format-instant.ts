import { type Result, andThen, map } from '@vp/result';
import type { FormatContext } from './context';
import type { FormatFailure } from './failures';
import { parseInstant } from './inputs';

/** A brand style names one decision; spelt-out fields repeated across call sites drift apart. */
export type DateStyle = 'short' | 'medium' | 'long' | 'full';

export function formatInstant(
  formatter: string,
  iso: string,
  options: Intl.DateTimeFormatOptions,
  context: FormatContext
): Result<string, FormatFailure> {
  const zoned = { ...options, timeZone: context.timeZone };
  return andThen(parseInstant(formatter, iso), (instant) =>
    map(context.cache.dateTimeFormat(context.locale, zoned), (format) => format.format(instant))
  );
}
