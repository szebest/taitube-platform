import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl feed', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'feed.empty', expected: 'Nie ma tu jeszcze żadnych filmów' },
    { key: 'feed.loadMoreFailed', expected: 'Nie udało się wczytać kolejnych filmów' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
