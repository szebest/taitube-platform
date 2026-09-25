import { type Result, andThen, err, map, ok } from '@vp/result';
import type { DurationFormatOptions, DurationParts } from '../duration-fallback';
import { type FormatFailure, unrenderable } from '../failures';
import { finite } from '../inputs';
import { type OptionKeys, withOptions } from '../with-options';

/** `Intl.DurationFormat` has no TypeScript options type yet, so the shape this formatter offers is its own. */
interface DurationChoices {
  readonly style: 'clock' | 'words';
  readonly unitDisplay: 'short' | 'long' | 'narrow';
}

export const DURATION_OPTION_KEYS = [
  'style',
  'unitDisplay',
] as const satisfies OptionKeys<DurationChoices>;

export type DurationOptions = Partial<Pick<DurationChoices, (typeof DURATION_OPTION_KEYS)[number]>>;

/** In seconds: `765` is `12:45` as a clock, `12 min, 45 sec` in words. */
export interface DurationValue {
  readonly type: 'duration';
  readonly value: number;
  readonly options?: DurationOptions;
}

function toParts(totalSeconds: number): Result<DurationParts, FormatFailure> {
  if (totalSeconds < 0) return err(unrenderable('duration', `${totalSeconds} is negative`));
  const whole = Math.round(totalSeconds);
  return ok({
    hours: Math.floor(whole / 3600),
    minutes: Math.floor((whole % 3600) / 60),
    seconds: whole % 60,
  });
}

function durationFormatOptions(
  options: DurationOptions,
  parts: DurationParts
): DurationFormatOptions {
  if (options.style !== 'words') return { style: 'digital', hoursDisplay: 'auto' };
  const nothingElse = parts.hours === 0 && parts.minutes === 0 && parts.seconds === 0;
  return { style: options.unitDisplay ?? 'short', secondsDisplay: nothingElse ? 'always' : 'auto' };
}

export const duration = withOptions<DurationValue>(
  'duration',
  DURATION_OPTION_KEYS,
  (value, context) =>
    andThen(finite('duration', value.value), (totalSeconds) =>
      andThen(toParts(totalSeconds), (parts) => {
        const options = durationFormatOptions(value.options ?? {}, parts);
        return map(context.cache.durationFormat(context.locale, options), (format) =>
          format.format(parts)
        );
      })
    )
);
