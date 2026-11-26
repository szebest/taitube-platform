import { translatorFor } from '#app/lib/messages/__tests__/fixtures';

describe('apps/client/studio: en studio sharing', () => {
  const { t } = translatorFor('en');

  it.each([
    { expiry: '24h', expected: '24 hours' },
    { expiry: 'never', expected: 'Never' },
  ] as const)('names the expiry $expiry', ({ expiry, expected }) => {
    expect(t('studio.shareLinkExpiryOption', { expiry })).toEqual({ ok: true, value: expected });
  });

  it('names the state of a link', () => {
    expect(t('studio.shareLinkState', { state: 'revoked' })).toEqual({
      ok: true,
      value: 'Revoked',
    });
  });

  it.each([
    {
      key: 'studio.shareLinkRevokeFor',
      values: { label: 'Press' },
      expected: 'Revoke the link Press',
    },
    {
      key: 'studio.passwordHint',
      values: { min: 4, max: 128 },
      expected: '4 to 128 characters. It is never shown again, not even to you.',
    },
  ] as const)('writes $key', ({ key, values, expected }) => {
    expect(t(key, values)).toEqual({ ok: true, value: expected });
  });
});
