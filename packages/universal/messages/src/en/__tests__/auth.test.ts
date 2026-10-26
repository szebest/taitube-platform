import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en auth', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'auth.signIn', expected: 'Sign in' },
    { key: 'auth.noProvider', expected: 'No sign-in provider is configured for this build.' },
    { key: 'auth.expired', expected: 'Your session ended. Sign in again to carry on.' },
    { key: 'auth.upload', expected: 'Upload' },
    { key: 'auth.admin', expected: 'Admin' },
    { key: 'auth.signOut', expected: 'Sign out' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
