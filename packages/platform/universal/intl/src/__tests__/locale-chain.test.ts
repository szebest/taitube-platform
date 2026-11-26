import { localeChain } from '../locale-chain';

describe('@kit/intl: localeChain', () => {
  it.each([
    { tag: 'sv-FI', expected: ['sv-FI', 'sv'] },
    { tag: 'en-GB', expected: ['en-GB', 'en'] },
    { tag: 'en', expected: ['en'] },
    { tag: 'zh-Hant-TW', expected: ['zh-Hant-TW', 'zh-Hant', 'zh'] },
    { tag: 'de-DE-u-nu-latn', expected: ['de-DE', 'de'] },
  ])('walks $tag down to its language', ({ tag, expected }) => {
    expect(localeChain(tag)).toEqual({ ok: true, value: expected });
  });

  it('declines a tag that is not BCP 47', () => {
    expect(localeChain('not a locale')).toMatchObject({
      ok: false,
      error: { code: 'FORMAT_UNSUPPORTED_LOCALE', locale: 'not a locale' },
    });
  });
});
