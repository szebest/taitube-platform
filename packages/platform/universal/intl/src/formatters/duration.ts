import { type Result, andThen, err, map, ok } from '@kit/result';
import type { DurationFormatOptions, DurationParts } from '../duration-fallback';
import { type FormatFailure, unrenderable } from '../failures';
import { finite, isNumber } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';
import { HOUR, MINUTE } from '../time-spans';

/** This package's lib does not type `Intl.DurationFormat`, so the shape this formatter offers is its own. */
export interface DurationChoices {
  readonly style: 'clock' | 'words';
  readonly unitDisplay: 'short' | 'long' | 'narrow';
}

const DURATION_OPTION_KEYS = [
  'style',
  'unitDisplay',
] as const satisfies OptionKeys<DurationChoices>;

type DurationOptions = Partial<Pick<DurationChoices, (typeof DURATION_OPTION_KEYS)[number]>>;

function toParts(totalSeconds: number): Result<DurationParts, FormatFailure> {
  if (totalSeconds < 0) return err(unrenderable('duration', `${totalSeconds} is negative`));
  const whole = Math.round(totalSeconds);
  return ok({
    hours: Math.floor(whole / HOUR),
    minutes: Math.floor((whole % HOUR) / MINUTE),
    seconds: whole % MINUTE,
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

/** In seconds: `765` is `12:45` as a clock, `12 min, 45 sec` in words. */
export const duration = defineKind({
  name: 'duration',
  arg: isNumber,
  options: optionKeys<DurationOptions>(DURATION_OPTION_KEYS),
  render: (value, options, context) =>
    andThen(finite('duration', value), (totalSeconds) =>
      andThen(toParts(totalSeconds), (parts) => {
        const intlOptions = durationFormatOptions(options ?? {}, parts);
        return map(context.cache.durationFormat(context.locale, intlOptions), (format) =>
          format.format(parts)
        );
      })
    ),
});

/** @public */
export type DurationValue = TaggedOf<typeof duration>;
