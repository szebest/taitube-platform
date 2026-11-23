import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('apps/client/studio: pl appUi', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([{ key: 'appUi.sortedAscending', expected: 'posortowano rosnąco' }] as const)(
    'renders $key with no arguments',
    ({ key, expected }) => {
      expect(t(key)).toEqual({ ok: true, value: expected });
    }
  );

  it.each([
    { key: 'appUi.pageOf', args: { position: 1, count: 3 }, expected: 'Strona 1 z 3' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
