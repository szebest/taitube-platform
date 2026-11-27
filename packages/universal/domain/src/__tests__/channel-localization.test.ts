import type { ChannelLocalization } from '../channel';
import { pickLocalization } from '../channel-localization';

const row = (locale: string): ChannelLocalization => ({
  locale,
  description: `about ${locale}`,
  trailerVideoId: null,
});

describe('@vp/domain: pickLocalization', () => {
  it.each([
    {
      scenario: 'the most specific locale of the chain',
      chain: ['pl-PL', 'pl', 'en'],
      expected: 'pl',
    },
    { scenario: 'a later locale of the chain', chain: ['de-DE', 'de', 'en'], expected: 'en' },
    {
      scenario: 'nothing when no locale of the chain has a row',
      chain: ['fr-FR', 'fr'],
      expected: null,
    },
    { scenario: 'nothing for an empty chain', chain: [], expected: null },
  ])('picks $scenario', ({ chain, expected }) => {
    expect(pickLocalization([row('en'), row('pl')], chain)?.locale ?? null).toBe(expected);
  });
});
