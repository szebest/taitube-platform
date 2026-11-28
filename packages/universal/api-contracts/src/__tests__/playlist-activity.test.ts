import { listPlaylistActivity, restorePlaylistActivity } from '../playlist-activity';

const ID = '00000000-0000-7000-8000-00000000ac01';
const entry = (action: string, target: unknown) => ({
  id: ID,
  actorUserId: null,
  actor: null,
  createdAt: '2026-11-26T12:00:00.000Z',
  action,
  target,
});

describe('packages/api-contracts: playlist activity', () => {
  it('serves the log and the restore', () => {
    expect([listPlaylistActivity.path, restorePlaylistActivity.path]).toEqual([
      '/v1/playlists/:id/activity',
      '/v1/playlists/:id/activity/:activityId/restore',
    ]);
  });

  it.each([
    {
      scenario: 'a reorder with its count',
      row: entry('items_reordered', { count: 3 }),
      valid: true,
    },
    {
      scenario: 'a reorder with an item',
      row: entry('items_reordered', { itemId: ID }),
      valid: false,
    },
    { scenario: 'an unknown action', row: entry('hijacked', {}), valid: false },
  ])('reads $scenario as valid: $valid', ({ row, valid }) => {
    const page = { items: [row], nextCursor: null };

    expect(listPlaylistActivity.result.safeParse(page).success).toBe(valid);
  });
});
