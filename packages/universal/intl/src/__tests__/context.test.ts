import { USER, resolveCurrency } from '../context';
import { contextFor } from './fixtures';

describe('@vp/intl: the format context', () => {
  it.each([
    { requested: USER, configured: 'SEK', expected: 'SEK' },
    { requested: undefined, configured: 'GBP', expected: 'GBP' },
    { requested: 'JPY', configured: 'SEK', expected: 'JPY' },
    { requested: 'eur', configured: undefined, expected: 'eur' },
  ])(
    'resolves $requested against $configured to $expected',
    ({ requested, configured, expected }) => {
      const context = contextFor('en', { currency: configured });

      expect(resolveCurrency('money', requested, context)).toEqual({ ok: true, value: expected });
    }
  );

  it.each([
    {
      scenario: 'nothing requested or configured',
      requested: USER,
      reason: 'no currency given or configured',
    },
    { scenario: 'a code no engine knows', requested: 'ZZZ', reason: 'unknown currency ZZZ' },
  ])('fails on $scenario', ({ requested, reason }) => {
    expect(resolveCurrency('money', requested, contextFor('en'))).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'FORMAT_UNRENDERABLE', formatter: 'money', reason }),
    });
  });
});
