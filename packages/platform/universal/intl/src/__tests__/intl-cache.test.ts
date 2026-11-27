import { createIntlCache } from '../intl-cache';
import { WITHOUT_DURATION_FORMAT } from './fixtures';

describe('@kit/intl: the Intl cache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hands back the same instance for the same locale and options, whatever their order', () => {
    const cache = createIntlCache();
    const first = cache.numberFormat('en', { maximumFractionDigits: 1, notation: 'compact' });
    const again = cache.numberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

    expect(first.ok && again.ok && first.value === again.value).toBe(true);
  });

  it.each([
    { scenario: 'another locale', locale: 'de', options: { notation: 'compact' as const } },
    { scenario: 'other options', locale: 'en', options: { notation: 'standard' as const } },
  ])('builds a new instance for $scenario', ({ locale, options }) => {
    const cache = createIntlCache();
    const compact = cache.numberFormat('en', { notation: 'compact' });
    const other = cache.numberFormat(locale, options);

    expect(compact.ok && other.ok && compact.value !== other.value).toBe(true);
  });

  it('constructs nothing on the repeat path', () => {
    const cache = createIntlCache();
    cache.numberFormat('en', { notation: 'compact' });
    const lookups = vi.spyOn(Intl.NumberFormat, 'supportedLocalesOf');

    for (let i = 0; i < 1_000; i++) cache.numberFormat('en', { notation: 'compact' });

    expect(lookups).not.toHaveBeenCalled();
  });

  it.each([
    { scenario: 'a locale no engine data covers', locale: 'xx' },
    { scenario: 'a tag that is not BCP 47', locale: 'not a locale' },
  ])('fails on $scenario with the locale, and remembers it', ({ locale }) => {
    const cache = createIntlCache();
    const lookups = vi.spyOn(Intl.DateTimeFormat, 'supportedLocalesOf');

    const first = cache.dateTimeFormat(locale);
    const again = cache.dateTimeFormat(locale);

    expect(first).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'FORMAT_UNSUPPORTED_LOCALE', locale }),
    });
    expect(again).toBe(first);
    expect(lookups).toHaveBeenCalledTimes(1);
  });

  it('turns options the constructor refuses into an unrenderable failure instead of a throw', () => {
    const built = createIntlCache().numberFormat('en', { style: 'currency', currency: 'X' });

    expect(built).toMatchObject({
      ok: false,
      error: { code: 'FORMAT_UNRENDERABLE', formatter: 'NumberFormat' },
    });
  });

  it('builds afresh after clear', () => {
    const cache = createIntlCache();
    const before = cache.collator('sv');
    cache.clear();
    const after = cache.collator('sv');

    expect(before.ok && after.ok && before.value !== after.value).toBe(true);
  });

  it('forgets the oldest entry once a kind holds its bound', () => {
    const cache = createIntlCache();
    const oldest = cache.numberFormat('en', { maximumFractionDigits: 0 });
    for (let i = 0; i < 256; i++) {
      const minimumIntegerDigits = (i % 16) + 1;
      const maximumSignificantDigits = Math.floor(i / 16) + 1;
      cache.numberFormat('en', { minimumIntegerDigits, maximumSignificantDigits });
    }
    const rebuilt = cache.numberFormat('en', { maximumFractionDigits: 0 });

    expect(oldest.ok && rebuilt.ok && oldest.value !== rebuilt.value).toBe(true);
  });

  it.each([
    { kind: 'relativeTimeFormat', build: () => createIntlCache().relativeTimeFormat('ja') },
    { kind: 'pluralRules', build: () => createIntlCache().pluralRules('ar', { type: 'ordinal' }) },
    { kind: 'listFormat', build: () => createIntlCache().listFormat('de', { type: 'unit' }) },
    { kind: 'displayNames', build: () => createIntlCache().displayNames('sv', { type: 'region' }) },
    { kind: 'segmenter', build: () => createIntlCache().segmenter('th', { granularity: 'word' }) },
    {
      kind: 'durationFormat',
      build: () => createIntlCache().durationFormat('fi', { style: 'digital' }),
    },
  ])('builds a working $kind', ({ build }) => {
    expect(build().ok).toBe(true);
  });

  it('builds the duration fallback from an environment without Intl.DurationFormat', () => {
    const built = createIntlCache(WITHOUT_DURATION_FORMAT).durationFormat('en', {
      style: 'digital',
      hoursDisplay: 'auto',
    });

    expect(built.ok && built.value.format({ hours: 0, minutes: 12, seconds: 45 })).toBe('12:45');
    expect(built.ok && built.value).not.toBeInstanceOf(Reflect.get(Intl, 'DurationFormat'));
  });

  it('builds what a descriptor it was handed describes, once per locale and options', () => {
    const cache = createIntlCache();
    const create = vi.fn((locale: string, options: Intl.NumberFormatOptions) => {
      return new Intl.NumberFormat(locale, options);
    });
    const descriptor = {
      name: 'Probe',
      create,
      supportedLocalesOf: (locales: string[]) => Intl.NumberFormat.supportedLocalesOf(locales),
      is: (value: unknown): value is Intl.NumberFormat => value instanceof Intl.NumberFormat,
    };

    const first = cache.get(descriptor, 'de', { useGrouping: false });
    const again = cache.get(descriptor, 'de', { useGrouping: false });

    expect(first.ok && again.ok && first.value === again.value).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('knows the currencies the engine can render, and nothing it cannot', () => {
    const currencies = createIntlCache().currencies();

    expect([currencies.has('SEK'), currencies.has('ZZZ')]).toEqual([true, false]);
  });
});
