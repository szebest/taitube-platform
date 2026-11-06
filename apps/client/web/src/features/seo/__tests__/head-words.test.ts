import { LOCALE_DETAILS } from '@vp/messages';
import { headWords } from '../head-words';

describe('apps/client/web: headWords', () => {
  it.each([
    { locale: 'en', expected: 'Videos by Ada on Taitube.' },
    { locale: 'pl', expected: 'Filmy kanału Ada na Taitube.' },
  ] as const)('words the head in $locale', async ({ locale, expected }) => {
    const words = headWords({
      locale,
      catalogues: { [locale]: await LOCALE_DETAILS[locale].load() },
    });

    expect(words.locale).toBe(locale);
    expect(words.tOr('shell.channelDescription', { name: 'Ada' }, '')).toBe(expected);
  });
});
