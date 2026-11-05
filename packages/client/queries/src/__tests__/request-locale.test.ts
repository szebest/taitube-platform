import { createLocaleStore } from '@vp/intl-react';
import { type LocaleRequest, requestLocale } from '../request-locale';
import { inRequest } from './in-request';

async function requestLocaleOnServer(acceptLanguage: string, request: Partial<LocaleRequest> = {}) {
  const locales = createLocaleStore();
  const { value } = await inRequest(() => requestLocale(locales, { searchStr: '', ...request }), {
    acceptLanguage,
  });
  return { ...value, active: locales.snapshot().locale };
}

describe('@vp/queries: requestLocale during a server render', () => {
  it.each([
    {
      step: 'the lang param',
      acceptLanguage: 'en',
      request: { searchStr: '?lang=pl', persisted: 'en' },
      locale: 'pl',
    },
    {
      step: 'the saved preference',
      acceptLanguage: 'en',
      request: { searchStr: '?lang=', persisted: 'pl' },
      locale: 'pl',
    },
    {
      step: 'the first supported language Accept-Language lists',
      acceptLanguage: 'de, pl-PL;q=0.9, en;q=0.5',
      request: { persisted: null },
      locale: 'pl',
    },
    { step: 'en', acceptLanguage: 'de, fr', request: {}, locale: 'en' },
    {
      step: 'the saved preference, past a param no locale serves',
      acceptLanguage: 'en',
      request: { searchStr: '?lang=xx', persisted: 'pl-PL' },
      locale: 'pl',
    },
    {
      step: 'Accept-Language, past a saved tag that is no locale',
      acceptLanguage: 'pl',
      request: { persisted: 'not a tag' },
      locale: 'pl',
    },
  ])(
    'takes $step when nothing before it is served',
    async ({ acceptLanguage, request, locale }) => {
      const requested = await requestLocaleOnServer(acceptLanguage, request);

      expect(requested.locale).toBe(locale);
      expect(requested.active).toBe(locale);
    }
  );

  it.each([
    { header: 'en;q=0.5, pl', browserLocale: 'pl' },
    { header: 'pl;q=0, en-GB;q=0.1', browserLocale: 'en' },
    { header: 'pl;q=x, *;q=0.9, en-US', browserLocale: 'en' },
    { header: 'de-DE', browserLocale: undefined },
    { header: '', browserLocale: undefined },
  ])(
    'reads the most wanted supported language of Accept-Language "$header": $browserLocale',
    async ({ header, browserLocale }) => {
      expect((await requestLocaleOnServer(header)).browserLocale).toBe(browserLocale);
    }
  );
});
