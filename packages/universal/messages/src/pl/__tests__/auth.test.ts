import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

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
    {
      key: 'auth.signInBody',
      expected: 'Twoje konto zachowuje polubienia, subskrypcje i playlisty na każdym urządzeniu.',
    },
    { key: 'auth.signInDismiss', expected: 'Nie teraz' },
    { key: 'auth.signInLike', expected: 'Zaloguj się, aby polubić' },
    { key: 'auth.signInDislike', expected: 'Zaloguj się, aby nie polubić' },
    { key: 'auth.signInComment', expected: 'Zaloguj się, aby komentować' },
    { key: 'auth.signInReply', expected: 'Zaloguj się, aby odpowiedzieć' },
    { key: 'auth.signInHeart', expected: 'Zaloguj się, aby dawać serduszka komentarzom' },
    { key: 'auth.signInSubscribe', expected: 'Zaloguj się, aby subskrybować ten kanał' },
    { key: 'auth.signInSave', expected: 'Zaloguj się, aby zapisać ten film' },
    { key: 'auth.signInPlaylist', expected: 'Zaloguj się, aby dodać to do playlisty' },
    { key: 'auth.signInQueue', expected: 'Zaloguj się, aby ułożyć kolejkę' },
    { key: 'auth.signInClip', expected: 'Zaloguj się, aby stworzyć klip' },
    { key: 'auth.signInHistory', expected: 'Zaloguj się, aby zachować historię oglądania' },
    { key: 'auth.signInReport', expected: 'Zaloguj się, aby to zgłosić' },
    { key: 'auth.signInBell', expected: 'Zaloguj się, aby dostawać powiadomienia' },
    { key: 'auth.signInFeedback', expected: 'Zaloguj się, aby dostosować rekomendacje' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
