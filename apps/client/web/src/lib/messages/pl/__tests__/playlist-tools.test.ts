import { translatorFor } from '#app/lib/messages/__tests__/fixtures';
import { pl } from '..';

describe('apps/client/web: pl playlist tools', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'playlistTools.days', args: { count: 1 }, expected: '1 dzień' },
    { key: 'playlistTools.days', args: { count: 30 }, expected: '30 dni' },
    { key: 'playlistTools.minutes', args: { count: 22 }, expected: '22 minuty' },
    { key: 'playlistTools.plays', args: { count: 5 }, expected: '5 odtworzeń' },
    { key: 'playlistTools.expiry', args: { expiry: '24h' }, expected: '24 godzinach' },
    { key: 'playlistTools.field', args: { field: 'unwatched' }, expected: 'Nieobejrzane' },
  ] as const)('renders $key with $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
