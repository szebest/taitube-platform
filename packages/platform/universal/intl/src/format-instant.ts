import { type Result, andThen, map } from '@kit/result';
import type { FormatContext } from './context';
import type { FormatFailure } from './failures';
import { parseInstant } from './inputs';

/** A brand style names one decision; spelt-out fields repeated across call sites drift apart. */
export type DateStyle = 'short' | 'medium' | 'long' | 'full';

/** How a date kind reads its options: which `Intl` style `style` sets, and what it shows with none. */
export interface DateResolution {
  readonly styleKey: 'dateStyle' | 'timeStyle';
  readonly defaults: Intl.DateTimeFormatOptions;
}

export const DATE_RESOLUTION: DateResolution = {
  styleKey: 'dateStyle',
  defaults: { dateStyle: 'medium' },
};

/** `style` laid over the defaults, else the fields as given, else the defaults. */
export function resolveDateOptions(
  options: Intl.DateTimeFormatOptions & { readonly style?: DateStyle },
  { styleKey, defaults }: DateResolution
): Intl.DateTimeFormatOptions {
  const { style, ...fields } = options;
  if (style !== undefined) return { ...defaults, [styleKey]: style };
  return Object.keys(fields).length === 0 ? defaults : fields;
}

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
