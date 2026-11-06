import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio comments', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.commentsNav', args: undefined, expected: 'Comments' },
    { key: 'studio.commentsFilterOption', args: { filter: 'unanswered' }, expected: 'Unanswered' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
