import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl live', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'live.title', expected: 'Na żywo' },
    { key: 'live.emptyTitle', expected: 'Teraz nic nie jest transmitowane na żywo' },
    { key: 'live.browse', expected: 'Przeglądaj filmy' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'live.watching', args: { count: 3 }, expected: '3 oglądają' },
    { key: 'live.watching', args: { count: 5 }, expected: '5 ogląda' },
    {
      key: 'live.chatSlowMode',
      args: { seconds: 1 },
      expected: 'Tryb powolny: jedna wiadomość na sekundę',
    },
    {
      key: 'live.chatSlowMode',
      args: { seconds: 5 },
      expected: 'Tryb powolny: jedna wiadomość co 5 sekund',
    },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
