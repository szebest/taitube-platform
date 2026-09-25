import { FALLBACK_LOCALE, localeChain } from '../locale-chain';

describe('@vp/intl: localeChain', () => {
  it.each([
    { tag: 'sv-FI', expected: ['sv-FI', 'sv', 'en'] },
    { tag: 'en-GB', expected: ['en-GB', 'en'] },
    { tag: 'en', expected: ['en'] },
    { tag: 'zh-Hant-TW', expected: ['zh-Hant-TW', 'zh-Hant', 'zh', 'en'] },
    { tag: 'de-DE-u-nu-latn', expected: ['de-DE', 'de', 'en'] },
  ])('walks $tag down to the fallback', ({ tag, expected }) => {
    expect(localeChain(tag)).toEqual({ ok: true, value: expected });
  });

  it('ends at en', () => {
    expect(FALLBACK_LOCALE).toBe('en');
  });

  it('declines a tag that is not BCP 47', () => {
    expect(localeChain('not a locale')).toMatchObject({
      ok: false,
      error: { code: 'FORMAT_UNSUPPORTED_LOCALE', locale: 'not a locale' },
    });
  });
});
