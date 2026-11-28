import {
  type DurationFormatLike,
  type DurationFormatOptions,
  type DurationParts,
  createDurationFallback,
} from '../duration-fallback';
import { createIntlCache } from '../intl-cache';
import { WITHOUT_DURATION_FORMAT } from './fixtures';

interface NativeDurationFormat {
  new (locale: string, options: DurationFormatOptions): DurationFormatLike;
}

const { DurationFormat } = Intl as { DurationFormat?: NativeDurationFormat };

const LOCALES = [
  'en',
  'pl',
  'de',
  'fr',
  'es',
  'pt-BR',
  'ru',
  'ja',
  'ko',
  'zh',
  'ar',
  'ar-EG',
  'he',
  'hi',
  'th',
  'sv',
  'en-u-nu-thai',
];
const DURATIONS: DurationParts[] = [
  { hours: 0, minutes: 0, seconds: 0 },
  { hours: 0, minutes: 0, seconds: 1 },
  { hours: 0, minutes: 5, seconds: 0 },
  { hours: 2, minutes: 1, seconds: 1 },
  { hours: 123, minutes: 0, seconds: 7 },
  { days: 1, hours: 2, minutes: 0, seconds: 0 },
];
const OPTIONS: DurationFormatOptions[] = [
  { style: 'digital', hoursDisplay: 'auto' },
  { style: 'digital', hoursDisplay: 'always' },
  { style: 'short' },
  { style: 'long' },
  { style: 'narrow' },
  { style: 'short', secondsDisplay: 'always' },
];

const cases = LOCALES.flatMap((locale) =>
  OPTIONS.flatMap((options) => DURATIONS.map((duration) => ({ locale, options, duration })))
);

function fallbackText(locale: string, options: DurationFormatOptions, duration: DurationParts) {
  const fallback = createDurationFallback(locale, options, createIntlCache());
  return fallback.ok && fallback.value.format(duration);
}

describe('@kit/intl: the fallback against the native constructor', () => {
  it.each(cases)(
    'renders $duration as $options in $locale exactly as the native path does',
    ({ locale, options, duration }) => {
      const native = DurationFormat && new DurationFormat(locale, options).format(duration);

      expect(fallbackText(locale, options, duration)).toBe(native);
    }
  );
});

describe('@kit/intl: the Intl.DurationFormat fallback', () => {
  it.each([
    { locale: 'en', expected: '1 day, 2 hours' },
    { locale: 'pl', expected: '1 dzień i 2 godziny' },
  ])('is what a cache without DurationFormat builds for $locale', ({ locale, expected }) => {
    const built = createIntlCache(WITHOUT_DURATION_FORMAT).durationFormat(locale, {
      style: 'long',
    });

    expect(built.ok && built.value.format({ days: 1, hours: 2, minutes: 0, seconds: 0 })).toBe(
      expected
    );
  });

  it('fails with the locale when the locale is unsupported', () => {
    const fallback = createDurationFallback('xx', { style: 'short' }, createIntlCache());

    expect(fallback).toMatchObject({ ok: false, error: { code: 'FORMAT_UNSUPPORTED_LOCALE' } });
  });
});
