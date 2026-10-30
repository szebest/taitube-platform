import { type Result, all, andThen, map } from '@vp/result';
import type { FormatFailure } from './failures';
import type { IntlCache } from './intl-cache';

export interface DurationParts {
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

export interface DurationFormatOptions {
  readonly style: 'digital' | 'short' | 'long' | 'narrow';
  readonly hoursDisplay?: 'auto' | 'always';
  readonly secondsDisplay?: 'auto' | 'always';
}

export interface DurationFormatLike {
  format(duration: DurationParts): string;
}

type WordStyle = Exclude<DurationFormatOptions['style'], 'digital'>;

const FIELDS = [
  { field: 'hours', unit: 'hour' },
  { field: 'minutes', unit: 'minute' },
  { field: 'seconds', unit: 'second' },
] as const;

function timeSeparator(locale: string, cache: IntlCache): Result<string, FormatFailure> {
  const clock = cache.dateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  });
  return map(clock, (format) => {
    const parts = format.formatToParts(0);
    const afterMinute = parts[parts.findIndex((part) => part.type === 'minute') + 1];
    return afterMinute?.value ?? ':';
  });
}

function digital(
  locale: string,
  hoursDisplay: DurationFormatOptions['hoursDisplay'],
  cache: IntlCache
): Result<DurationFormatLike, FormatFailure> {
  return andThen(timeSeparator(locale, cache), (separator) =>
    andThen(cache.numberFormat(locale, { useGrouping: false }), (hours) =>
      map(
        cache.numberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }),
        (padded) => ({
          format: (duration: DurationParts) => {
            const minutesAndSeconds = [
              padded.format(duration.minutes),
              padded.format(duration.seconds),
            ];
            const showHours = hoursDisplay !== 'auto' || duration.hours > 0;
            const shown = showHours
              ? [hours.format(duration.hours), ...minutesAndSeconds]
              : minutesAndSeconds;
            return shown.join(separator);
          },
        })
      )
    )
  );
}

function words(
  locale: string,
  style: WordStyle,
  secondsDisplay: DurationFormatOptions['secondsDisplay'],
  cache: IntlCache
): Result<DurationFormatLike, FormatFailure> {
  const units = all(
    FIELDS.map(({ field, unit }) =>
      map(cache.numberFormat(locale, { style: 'unit', unit, unitDisplay: style }), (format) => ({
        field,
        format,
      }))
    )
  );
  return andThen(units, (formats) =>
    map(cache.listFormat(locale, { type: 'unit', style }), (list) => ({
      format: (duration: DurationParts) => {
        const shown = formats.filter(
          ({ field }) =>
            duration[field] !== 0 || (field === 'seconds' && secondsDisplay === 'always')
        );
        return list.format(shown.map(({ field, format }) => format.format(duration[field])));
      },
    }))
  );
}

/**
 * `Intl.DurationFormat` rebuilt from the constructors every supported engine has, the way its
 * specification composes them, so an engine without it renders the same string.
 */
export function createDurationFallback(
  locale: string,
  options: DurationFormatOptions,
  cache: IntlCache
): Result<DurationFormatLike, FormatFailure> {
  return options.style === 'digital'
    ? digital(locale, options.hoursDisplay, cache)
    : words(locale, options.style, options.secondsDisplay, cache);
}
