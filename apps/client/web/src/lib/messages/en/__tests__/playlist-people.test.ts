import { translatorFor } from '#app/lib/messages/__tests__/fixtures';

describe('apps/client/web: en playlist people', () => {
  const { t } = translatorFor('en');

  it.each([
    {
      key: 'playlistPeople.smartSummary',
      args: { mode: 'any', count: 3, max: 50 },
      expected: 'Any of 3 conditions · up to 50 videos',
    },
    {
      key: 'playlistPeople.smartSummary',
      args: { mode: 'all', count: 1, max: 200 },
      expected: 'All of 1 condition · up to 200 videos',
    },
    {
      key: 'playlistPeople.moreCollaborators',
      args: { count: 2 },
      expected: '2 more collaborators',
    },
    { key: 'playlistPeople.menu', args: { action: 'shareLinks' }, expected: 'Share links' },
    { key: 'playlistPeople.days', args: { count: 1 }, expected: '1 day' },
    { key: 'playlistPeople.uses', args: { count: 20 }, expected: '20 uses' },
    { key: 'playlistPeople.inviteState', args: { state: 'exhausted' }, expected: 'Used up' },
    { key: 'playlistPeople.usage', args: { count: 3, max: 5 }, expected: '3 of 5 used' },
    {
      key: 'playlistPeople.itemsReordered',
      args: { name: 'Ana', count: 1 },
      expected: 'Ana moved 1 video',
    },
    {
      key: 'playlistPeople.collaboratorJoined',
      args: { name: 'Ana', role: 'editor' },
      expected: 'Ana joined as an editor',
    },
  ] as const)('renders $key with $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
