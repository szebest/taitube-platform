import { isSupportedLocale } from '../locales';

describe('@vp/messages: the supported locales', () => {
  it.each([
    { tag: 'pl', supported: true },
    { tag: 'en', supported: true },
    { tag: 'pl-PL', supported: false },
    { tag: 'de', supported: false },
  ])('calls $tag supported: $supported', ({ tag, supported }) => {
    expect(isSupportedLocale(tag)).toBe(supported);
  });
});
