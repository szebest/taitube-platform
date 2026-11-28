import { createIntl, createIntlCache } from '@kit/intl';
import { en, sharedI18n } from '@vp/shared-messages';
import { pl } from '@vp/shared-messages/pl';
import { localeChainOf } from '../locale-chain';

describe('localeChainOf', () => {
  it.each([
    { scenario: 'nothing asked', explicit: undefined, header: undefined, expected: ['en'] },
    {
      scenario: 'an explicit tag',
      explicit: 'pl-PL',
      header: undefined,
      expected: ['pl-PL', 'pl', 'en'],
    },
    {
      scenario: 'the header by quality',
      explicit: undefined,
      header: 'de;q=0.5, pl-PL;q=0.9, en;q=0.1',
      expected: ['pl-PL', 'pl', 'de', 'en'],
    },
    {
      scenario: 'an explicit tag over the header',
      explicit: 'pl',
      header: 'de',
      expected: ['pl', 'de', 'en'],
    },
    {
      scenario: 'a wildcard, a refused tag and junk',
      explicit: 'not a locale',
      header: '*, de;q=0, fr',
      expected: ['fr', 'en'],
    },
  ])('reads $scenario', ({ explicit, header, expected }) => {
    expect(localeChainOf(explicit, header)).toEqual(expected);
  });
});

describe('the server rendering words on the engine the clients use', () => {
  it.each([
    { header: undefined, count: 1500, expected: '1.5K views' },
    { header: 'pl-PL', count: 1, expected: '1 wyświetlenie' },
    { header: 'pl;q=0.9, en;q=0.5', count: 1500, expected: '1,5\u00a0tys. wyświetleń' },
    { header: 'pl', count: 5, expected: '5 wyświetleń' },
    { header: 'de', count: 12, expected: '12 views' },
  ])(
    'renders $count views for $header as $expected, as the client does',
    ({ header, count, expected }) => {
      const [locale = 'en'] = localeChainOf(undefined, header);
      const intl = createIntl({ locale, timeZone: 'UTC', cache: createIntlCache() });
      const { tOr } = sharedI18n.createTranslator(intl, {
        locale: 'en',
        source: en,
        translations: { pl },
      });

      expect(tOr('videos.views', { count }, '')).toBe(expected);
    }
  );
});
