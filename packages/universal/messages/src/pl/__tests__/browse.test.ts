import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl browse', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([{ key: 'browse.untitled', expected: 'Film bez tytułu' }] as const)(
    'renders $key with no arguments',
    ({ key, expected }) => {
      expect(t(key)).toEqual({ ok: true, value: expected });
    }
  );
});
