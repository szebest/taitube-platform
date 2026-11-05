import { createLocaleStore } from '@vp/intl-react';
import { requestLocale } from '../request-locale';

describe('@vp/queries: request locale in the browser', () => {
  it.each([
    { languages: ['de-DE', 'pl-PL'], locale: 'pl' },
    { languages: ['de-DE'], locale: 'en' },
  ])(
    "negotiates $languages on a client-only navigation from the browser's languages",
    async ({ languages, locale }) => {
      vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);

      const requested = await requestLocale(createLocaleStore(), { searchStr: '' });

      expect(requested.locale).toBe(locale);
    }
  );
});
