import { translatorFor } from '#app/lib/messages/__tests__/fixtures';
import { pl } from '..';

describe('apps/client/web: pl playlist people', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    {
      key: 'playlistPeople.smartSummary',
      args: { mode: 'any', count: 3, max: 50 },
      expected: 'Dowolny z 3 warunków · do 50 filmów',
    },
    { key: 'playlistPeople.days', args: { count: 7 }, expected: '7 dniach' },
    { key: 'playlistPeople.uses', args: { count: 5 }, expected: '5 użyć' },
    { key: 'playlistPeople.uses', args: { count: 2 }, expected: '2 użycia' },
    {
      key: 'playlistPeople.itemsReordered',
      args: { name: 'Ana', count: 3 },
      expected: 'Ana przesuwa 3 filmy',
    },
    { key: 'playlistPeople.inviteState', args: { state: 'exhausted' }, expected: 'Wykorzystane' },
  ] as const)('renders $key with $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
