import { en } from '../en';
import { isSupportedLocale, LOCALE_DETAILS } from '../locales';
import { pl } from '../pl';

describe('@vp/messages: the supported locales', () => {
  it.each([
    { locale: 'en', catalogue: en },
    { locale: 'pl', catalogue: pl },
  ] as const)('loads the $locale catalogue', async ({ locale, catalogue }) => {
    await expect(LOCALE_DETAILS[locale].load()).resolves.toBe(catalogue);
  });

  it.each([
    { tag: 'pl', supported: true },
    { tag: 'en', supported: true },
    { tag: 'pl-PL', supported: false },
    { tag: 'de', supported: false },
  ])('calls $tag supported: $supported', ({ tag, supported }) => {
    expect(isSupportedLocale(tag)).toBe(supported);
  });
});
