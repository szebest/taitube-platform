import { translatorFor } from '../../__tests__/web-fixtures';
import { pl } from '../web';

describe('@vp/messages: pl signInPrompt', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    {
      key: 'signInPrompt.body',
      expected: 'Twoje konto zachowuje polubienia, subskrypcje i playlisty na każdym urządzeniu.',
    },
    { key: 'signInPrompt.dismiss', expected: 'Nie teraz' },
    { key: 'signInPrompt.like', expected: 'Zaloguj się, aby polubić' },
    { key: 'signInPrompt.dislike', expected: 'Zaloguj się, aby nie polubić' },
    { key: 'signInPrompt.comment', expected: 'Zaloguj się, aby komentować' },
    { key: 'signInPrompt.reply', expected: 'Zaloguj się, aby odpowiedzieć' },
    { key: 'signInPrompt.heart', expected: 'Zaloguj się, aby dawać serduszka komentarzom' },
    { key: 'signInPrompt.subscribe', expected: 'Zaloguj się, aby subskrybować ten kanał' },
    { key: 'signInPrompt.save', expected: 'Zaloguj się, aby zapisać ten film' },
    { key: 'signInPrompt.playlist', expected: 'Zaloguj się, aby dodać to do playlisty' },
    { key: 'signInPrompt.queue', expected: 'Zaloguj się, aby ułożyć kolejkę' },
    { key: 'signInPrompt.clip', expected: 'Zaloguj się, aby stworzyć klip' },
    { key: 'signInPrompt.history', expected: 'Zaloguj się, aby zachować historię oglądania' },
    { key: 'signInPrompt.report', expected: 'Zaloguj się, aby to zgłosić' },
    { key: 'signInPrompt.bell', expected: 'Zaloguj się, aby dostawać powiadomienia' },
    { key: 'signInPrompt.feedback', expected: 'Zaloguj się, aby dostosować rekomendacje' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
