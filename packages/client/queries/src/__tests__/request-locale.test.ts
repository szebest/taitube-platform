import { createLocaleStore } from '@vp/intl-react';
import {
  acceptedLanguages,
  type LocaleRequest,
  matchSupportedLocale,
  negotiateLocale,
  requestLocale,
} from '../request-locale';
import { inRequest } from './in-request';

async function requestLocaleOnServer(acceptLanguage: string, request: Partial<LocaleRequest> = {}) {
  const locales = createLocaleStore();
  const { value } = await inRequest(() => requestLocale(locales, { searchStr: '', ...request }), {
    acceptLanguage,
  });
  return { requested: value, active: locales.snapshot().locale };
}

describe('@vp/queries: request locale', () => {
  it.each([
    { tag: 'pl', expected: 'pl' },
    { tag: 'pl-PL', expected: 'pl' },
    { tag: 'en-GB', expected: 'en' },
    { tag: 'de-DE', expected: undefined },
    { tag: 'not a tag', expected: undefined },
    { tag: '', expected: undefined },
    { tag: null, expected: undefined },
  ])('serves $tag with $expected', ({ tag, expected }) => {
    expect(matchSupportedLocale(tag)).toBe(expected);
  });

  it.each([
    { header: 'pl-PL,pl;q=0.9,en;q=0.8', expected: ['pl-PL', 'pl', 'en'] },
    { header: 'en;q=0.5, pl', expected: ['pl', 'en'] },
    { header: 'de;q=0, *;q=0.1, sv', expected: ['sv'] },
    { header: 'pl;q=x, en', expected: ['en'] },
    { header: '', expected: [] },
    { header: undefined, expected: [] },
  ])('lists the tags of Accept-Language "$header" most wanted first', ({ header, expected }) => {
    expect(acceptedLanguages(header)).toEqual(expected);
  });

  it.each([
    {
      step: 'the URL param',
      candidates: { requested: 'pl', persisted: 'en', accepted: ['en'] },
      expected: 'pl',
    },
    {
      step: 'the saved preference',
      candidates: { requested: null, persisted: 'pl', accepted: ['en'] },
      expected: 'pl',
    },
    {
      step: 'the first supported language the viewer accepts',
      candidates: { persisted: null, accepted: ['de', 'pl-PL', 'en'] },
      expected: 'pl',
    },
    { step: 'en', candidates: { accepted: ['de', 'fr'] }, expected: 'en' },
    {
      step: 'the preference, past a param no locale serves',
      candidates: { requested: 'xx', persisted: 'pl', accepted: [] },
      expected: 'pl',
    },
  ])('takes $step when nothing before it is served', ({ candidates, expected }) => {
    expect(negotiateLocale(candidates)).toBe(expected);
  });

  it.each([
    {
      scenario: 'Accept-Language alone',
      acceptLanguage: 'pl-PL,en;q=0.5',
      request: {},
      expected: { locale: 'pl', direction: 'ltr', browserLocale: 'pl' },
    },
    {
      scenario: 'a saved preference over Accept-Language',
      acceptLanguage: 'pl',
      request: { persisted: 'en' },
      expected: { locale: 'en', direction: 'ltr', browserLocale: 'pl' },
    },
    {
      scenario: 'the lang param over the saved preference',
      acceptLanguage: 'de',
      request: { searchStr: '?lang=pl', persisted: 'en' },
      expected: { locale: 'pl', direction: 'ltr', browserLocale: undefined },
    },
  ])(
    'negotiates $scenario during a server render, and activates the locale it chose',
    async ({ acceptLanguage, request, expected }) => {
      const { requested, active } = await requestLocaleOnServer(acceptLanguage, request);

      expect(requested).toEqual(expected);
      expect(active).toBe(expected.locale);
    }
  );
});
