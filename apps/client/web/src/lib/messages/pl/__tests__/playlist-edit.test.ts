import { translatorFor } from '#app/lib/messages/__tests__/fixtures';
import { pl } from '..';

describe('apps/client/web: pl playlistEdit', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'playlistEdit.addedBy', args: { name: 'Marta' }, expected: 'Dodane przez: Marta' },
    {
      key: 'playlistEdit.segmentRange',
      args: { start: '0:30', end: '1:45' },
      expected: 'Od 0:30 do 1:45',
    },
    {
      key: 'playlistEdit.sortMenu',
      args: { sort: 'duration' },
      expected: 'Sortowanie: Najkrótsze najpierw',
    },
    {
      key: 'playlistEdit.transferBody',
      args: { count: 1 },
      expected: 'Wybierz, dokąd trafi zaznaczony film.',
    },
    {
      key: 'playlistEdit.transferBody',
      args: { count: 3 },
      expected: 'Wybierz, dokąd trafią 3 zaznaczone filmy.',
    },
    {
      key: 'playlistEdit.transferBody',
      args: { count: 5 },
      expected: 'Wybierz, dokąd trafi 5 zaznaczonych filmów.',
    },
    {
      key: 'playlistEdit.resultLanded',
      args: { mode: 'move', count: 2 },
      expected: 'Przeniesiono: 2',
    },
    {
      key: 'playlistEdit.importLine',
      args: { row: 4, status: 'duplicate' },
      expected: 'Wiersz 4: Już jest na playliście',
    },
    { key: 'playlistEdit.unavailable', args: undefined, expected: 'Już niedostępna' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
