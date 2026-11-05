import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl error page', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'errorPage.notFoundTitle', expected: 'Nie znaleziono strony' },
    { key: 'errorPage.unauthorisedTitle', expected: 'Zaloguj się, aby kontynuować' },
    { key: 'errorPage.serverTitle', expected: 'Coś poszło nie tak po naszej stronie' },
    { key: 'errorPage.home', expected: 'Przejdź do strony głównej' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
