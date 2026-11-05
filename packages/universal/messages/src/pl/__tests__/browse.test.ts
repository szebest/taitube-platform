import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl browse', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'browse.untitled', expected: 'Film bez tytułu' },
    { key: 'browse.empty', expected: 'Nie ma tu jeszcze żadnych filmów' },
    { key: 'browse.loadMoreFailed', expected: 'Nie udało się wczytać kolejnych filmów' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
