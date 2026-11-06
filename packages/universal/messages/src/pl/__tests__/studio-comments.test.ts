import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio comments', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.commentsNav', args: undefined, expected: 'Komentarze' },
    {
      key: 'studio.commentsFilterOption',
      args: { filter: 'unanswered' },
      expected: 'Bez odpowiedzi',
    },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
