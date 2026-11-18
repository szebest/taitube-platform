import {
  type DurationFormatLike,
  type DurationFormatOptions,
  type DurationParts,
  createDurationFallback,
} from '../duration-fallback';
import { createIntlCache } from '../intl-cache';

interface NativeDurationFormat {
  new (locale: string, options: DurationFormatOptions): DurationFormatLike;
}

const { DurationFormat } = Intl as { DurationFormat?: NativeDurationFormat };

const LOCALES = ['en', 'de', 'fi', 'ja', 'ar-EG'];
const DURATIONS: DurationParts[] = [
  { hours: 0, minutes: 12, seconds: 45 },
  { hours: 1, minutes: 2, seconds: 33 },
  { hours: 0, minutes: 0, seconds: 5 },
  { hours: 10, minutes: 0, seconds: 0 },
];
const OPTIONS: DurationFormatOptions[] = [
  { style: 'digital', hoursDisplay: 'auto' },
  { style: 'digital' },
  { style: 'short' },
  { style: 'long' },
  { style: 'narrow' },
  { style: 'short', secondsDisplay: 'always' },
];

const cases = LOCALES.flatMap((locale) =>
  OPTIONS.flatMap((options) => DURATIONS.map((duration) => ({ locale, options, duration })))
);

describe('@vp/intl: the Intl.DurationFormat fallback', () => {
  it('runs where the engine ships the native constructor to compare against', () => {
    expect(typeof DurationFormat).toBe('function');
  });

  it.each(cases)(
    'renders $duration as $options.style in $locale exactly as the native path does',
    ({ locale, options, duration }) => {
      const fallback = createDurationFallback(locale, options, createIntlCache());
      const native = DurationFormat && new DurationFormat(locale, options).format(duration);

      expect(fallback.ok && fallback.value.format(duration)).toBe(native);
    }
  );

  it('fails with the locale when the locale is unsupported', () => {
    const fallback = createDurationFallback('xx', { style: 'short' }, createIntlCache());

    expect(fallback).toMatchObject({ ok: false, error: { code: 'FORMAT_UNSUPPORTED_LOCALE' } });
  });
});
