import { type Result, andThen, err, map, ok } from '@kit/result';
import type { DurationFormatOptions, DurationParts } from '../duration-fallback';
import { type FormatFailure, unrenderable } from '../failures';
import { finite, isNumber } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';
import { HOUR, MINUTE } from '../time-spans';

/**
 * This package's lib does not type `Intl.DurationFormat`, so the shape this formatter offers is its own.
 * `unit` is what the value counts (seconds by default), `maxUnits` keeps only the largest few of a
 * spoken duration (`1 hr, 2 min`, not `1 hr, 2 min, 33 sec`) and `hoursDisplay: 'always'` writes
 * `0:12:45` for a clock.
 */
export interface DurationChoices {
  readonly style: 'clock' | 'words';
  readonly unitDisplay: 'short' | 'long' | 'narrow';
  readonly unit: 'seconds' | 'milliseconds';
  readonly maxUnits: number;
  readonly hoursDisplay: 'auto' | 'always';
}

const DURATION_OPTION_KEYS = [
  'style',
  'unitDisplay',
  'unit',
  'maxUnits',
  'hoursDisplay',
] as const satisfies OptionKeys<DurationChoices>;

type DurationOptions = Partial<Pick<DurationChoices, (typeof DURATION_OPTION_KEYS)[number]>>;

const MILLISECONDS_PER_SECOND = 1000;

function toParts(
  totalSeconds: number,
  maxUnits: number | undefined
): Result<DurationParts, FormatFailure> {
  if (totalSeconds < 0) return err(unrenderable('duration', `${totalSeconds} is negative`));
  if (maxUnits !== undefined && (!Number.isInteger(maxUnits) || maxUnits < 1)) {
    return err(unrenderable('duration', `maxUnits ${maxUnits} is not a whole number of units`));
  }
  const whole = Math.round(totalSeconds);
  const fields = [Math.floor(whole / HOUR), Math.floor((whole % HOUR) / MINUTE), whole % MINUTE];
  const largest = Math.max(
    fields.findIndex((field) => field !== 0),
    0
  );
  const [hours = 0, minutes = 0, seconds = 0] = fields.map((field, index) =>
    maxUnits !== undefined && index >= largest + maxUnits ? 0 : field
  );
  return ok({ hours, minutes, seconds });
}

function durationFormatOptions(
  options: DurationOptions,
  parts: DurationParts
): DurationFormatOptions {
  const { hoursDisplay = 'auto' } = options;
  if (options.style !== 'words') return { style: 'digital', hoursDisplay };
  const nothingElse = parts.hours === 0 && parts.minutes === 0 && parts.seconds === 0;
  return {
    style: options.unitDisplay ?? 'short',
    hoursDisplay,
    secondsDisplay: nothingElse ? 'always' : 'auto',
  };
}

/** In seconds: `765` is `12:45` as a clock, `12 min, 45 sec` in words. */
export const duration = defineKind({
  name: 'duration',
  arg: isNumber,
  options: optionKeys<DurationOptions>(DURATION_OPTION_KEYS),
  render: (value, options, context) =>
    andThen(finite('duration', value), (counted) => {
      const totalSeconds =
        options?.unit === 'milliseconds' ? counted / MILLISECONDS_PER_SECOND : counted;
      return andThen(toParts(totalSeconds, options?.maxUnits), (parts) => {
        const intlOptions = durationFormatOptions(options ?? {}, parts);
        return map(context.cache.durationFormat(context.locale, intlOptions), (format) =>
          format.format(parts)
        );
      });
    }),
});

/** @public */
export type DurationValue = TaggedOf<typeof duration>;
