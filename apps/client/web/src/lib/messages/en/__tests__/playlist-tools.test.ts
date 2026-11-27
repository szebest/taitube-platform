import { translatorFor } from '#app/lib/messages/__tests__/fixtures';

describe('apps/client/web: en playlist tools', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'playlistTools.expiry', args: { expiry: 'never' }, expected: 'Never' },
    { key: 'playlistTools.opens', args: { count: 1 }, expected: '1 open' },
    { key: 'playlistTools.measure', args: { metric: 'opens' }, expected: 'Page opens' },
    { key: 'playlistTools.plays', args: { count: 12 }, expected: '12 plays' },
    {
      key: 'playlistTools.autoRemoveBlocked',
      args: { reason: 'collaborators' },
      expected: 'Not available while others work on this playlist',
    },
    { key: 'playlistTools.field', args: { field: 'newer_than' }, expected: 'Newer than' },
    { key: 'playlistTools.removeCondition', args: { position: 2 }, expected: 'Remove condition 2' },
    { key: 'playlistTools.minutesRange', args: { min: 2, max: 30 }, expected: '2 to 30 minutes' },
    { key: 'playlistTools.limit', args: { count: 1 }, expected: '1 video' },
    { key: 'playlistTools.sort', args: { sort: 'popular' }, expected: 'Most viewed' },
  ] as const)('renders $key with $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
