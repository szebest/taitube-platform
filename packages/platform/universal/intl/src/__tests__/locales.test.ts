import { defineLocales } from '../locales';

const LOCALES = defineLocales({
  source: 'fr',
  details: {
    fr: { name: 'Français', direction: 'ltr' },
    ar: { name: 'العربية', direction: 'rtl' },
  },
});

describe('@kit/intl: defineLocales', () => {
  it('lists the tags the app registered, with their details and its source', () => {
    expect([LOCALES.source, LOCALES.tags, LOCALES.details.ar.direction]).toEqual([
      'fr',
      ['fr', 'ar'],
      'rtl',
    ]);
  });

  it.each([
    { tag: 'ar', supported: true },
    { tag: 'fr-CA', supported: false },
    { tag: 'toString', supported: false },
  ])('calls $tag supported: $supported', ({ tag, supported }) => {
    expect(LOCALES.isSupported(tag)).toBe(supported);
  });
});
