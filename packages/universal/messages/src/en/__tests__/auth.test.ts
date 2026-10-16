import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en auth', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'auth.signIn', expected: 'Sign in' },
    { key: 'auth.noProvider', expected: 'No sign-in provider is configured for this build.' },
    { key: 'auth.account', expected: 'Account' },
    { key: 'auth.upload', expected: 'Upload' },
    { key: 'auth.admin', expected: 'Admin' },
    { key: 'auth.signOut', expected: 'Sign out' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
