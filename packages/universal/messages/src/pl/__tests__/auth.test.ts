import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl auth', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'auth.signIn', expected: 'Zaloguj się' },
    {
      key: 'auth.expired',
      expected: 'Twoja sesja wygasła. Zaloguj się ponownie, aby kontynuować.',
    },
    { key: 'auth.upload', expected: 'Prześlij' },
    { key: 'auth.signOut', expected: 'Wyloguj się' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
