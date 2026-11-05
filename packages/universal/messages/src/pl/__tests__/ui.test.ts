import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl ui', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'ui.close', expected: 'Zamknij' },
    { key: 'ui.modeSystem', expected: 'Systemowy' },
    { key: 'ui.markAllRead', expected: 'Oznacz wszystkie jako przeczytane' },
    { key: 'ui.sortedAscending', expected: 'posortowano rosnąco' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'ui.reorder', args: { name: 'Muzyka' }, expected: 'Zmień kolejność: Muzyka' },
    {
      key: 'ui.pickedUp',
      args: { name: 'Muzyka', position: 2, count: 5 },
      expected: 'Podniesiono Muzyka, pozycja 2 z 5',
    },
    { key: 'ui.viewReplies', args: { count: 4 }, expected: 'Zobacz odpowiedzi (4)' },
    { key: 'ui.pageOf', args: { position: 1, count: 3 }, expected: 'Strona 1 z 3' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
