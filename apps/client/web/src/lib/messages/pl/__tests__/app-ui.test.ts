import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('apps/client/web: pl appUi', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([{ key: 'appUi.markAllRead', expected: 'Oznacz wszystkie jako przeczytane' }] as const)(
    'renders $key with no arguments',
    ({ key, expected }) => {
      expect(t(key)).toEqual({ ok: true, value: expected });
    }
  );

  it.each([
    { key: 'appUi.viewReplies', args: { count: 4 }, expected: 'Zobacz odpowiedzi (4)' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
