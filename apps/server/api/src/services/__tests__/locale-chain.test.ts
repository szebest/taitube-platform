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
