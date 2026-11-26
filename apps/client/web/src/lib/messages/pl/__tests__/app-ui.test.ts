import { translatorFor } from '#app/lib/messages/__tests__/fixtures';
import { pl } from '..';

describe('apps/client/web: pl appUi', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'appUi.markAllRead', expected: 'Oznacz wszystkie jako przeczytane' },
    { key: 'appUi.send', expected: 'Wyślij' },
    { key: 'appUi.like', expected: 'Lubię to' },
    { key: 'appUi.chapters', expected: 'Rozdziały' },
    { key: 'appUi.reply', expected: 'Odpowiedz' },
    { key: 'appUi.shuffle', expected: 'Losowo' },
    { key: 'appUi.verified', expected: 'Zweryfikowany' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'appUi.viewReplies', args: { count: 4 }, expected: 'Zobacz odpowiedzi (4)' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
