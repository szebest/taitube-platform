import { translatorFor } from '../../__tests__/fixtures';

describe('apps/client/studio: en studio developer tokens', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.tokensRequestsToday', args: { count: 1 }, expected: '1 request today' },
    { key: 'studio.tokensRequestsToday', args: { count: 42 }, expected: '42 requests today' },
    {
      key: 'studio.tokensRevokeTitle',
      args: { name: 'Nightly sync' },
      expected: 'Revoke Nightly sync?',
    },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it('words a scope and an expiry', () => {
    expect(t('studio.tokenScope', { scope: 'videos:write' })).toEqual({
      ok: true,
      value: 'Edit details, chapters and visibility',
    });
    expect(t('studio.tokenExpiryOption', { expiry: '1y' })).toEqual({ ok: true, value: '1 year' });
  });
});
