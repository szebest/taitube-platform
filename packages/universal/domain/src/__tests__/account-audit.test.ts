import { accountAuditMeta } from '../account-audit';

const STORED_LENGTH = 200;

describe('@vp/domain: accountAuditMeta', () => {
  it.each([
    { scenario: 'no user agent', userAgent: undefined, expected: null },
    { scenario: 'an empty user agent', userAgent: '', expected: null },
    { scenario: 'a short user agent', userAgent: 'Firefox', expected: 'Firefox' },
    {
      scenario: 'a long user agent',
      userAgent: 'x'.repeat(STORED_LENGTH + 50),
      expected: 'x'.repeat(STORED_LENGTH),
    },
  ])('keeps the slot and stores $scenario as $expected', ({ userAgent, expected }) => {
    expect(accountAuditMeta(2, userAgent)).toEqual({ slot: 2, userAgent: expected });
  });
});
