import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl live', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'live.title', expected: 'Na żywo' },
    { key: 'live.emptyTitle', expected: 'Teraz nic nie jest transmitowane na żywo' },
    { key: 'live.browse', expected: 'Przeglądaj filmy' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
