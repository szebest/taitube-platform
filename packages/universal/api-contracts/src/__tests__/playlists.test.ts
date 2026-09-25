import {
  addPlaylistItem,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listMyPlaylists,
  removePlaylistItem,
  reorderPlaylist,
  updatePlaylist,
} from '../playlists';

const ITEM = '00000000-0000-7000-8000-00000000c0de';

describe('packages/api-contracts: playlists', () => {
  it.each([
    { endpoint: createPlaylist, method: 'POST', path: '/v1/playlists' },
    { endpoint: getPlaylist, method: 'GET', path: '/v1/playlists/:id' },
    { endpoint: updatePlaylist, method: 'PATCH', path: '/v1/playlists/:id' },
    { endpoint: deletePlaylist, method: 'DELETE', path: '/v1/playlists/:id' },
    { endpoint: addPlaylistItem, method: 'POST', path: '/v1/playlists/:id/items' },
    { endpoint: removePlaylistItem, method: 'DELETE', path: '/v1/playlists/:id/items/:videoId' },
    { endpoint: reorderPlaylist, method: 'PUT', path: '/v1/playlists/:id/reorder' },
    { endpoint: listMyPlaylists, method: 'GET', path: '/v1/me/playlists' },
  ])('serves $method $path', ({ endpoint, method, path }) => {
    expect(endpoint).toMatchObject({ method, path });
  });

  it('opens only the read to anonymous viewers', () => {
    expect(getPlaylist.anonymous).toBe(true);
    expect(createPlaylist).not.toHaveProperty('anonymous');
  });

  it.each([
    {
      name: 'a single move',
      body: { itemId: ITEM, newPosition: 2 },
      change: { type: 'move', itemId: ITEM, index: 2 },
    },
    {
      name: 'a full order',
      body: { itemIds: [ITEM] },
      change: { type: 'reindex', itemIds: [ITEM] },
    },
  ])('reads $name as its tagged reorder', ({ body, change }) => {
    expect(reorderPlaylist.body.parse(body)).toEqual(change);
  });

  it.each([
    { name: 'a negative place', body: { itemId: ITEM, newPosition: -1 } },
    { name: 'both shapes at once', body: { itemId: ITEM, newPosition: 0, itemIds: [ITEM] } },
    { name: 'neither shape', body: {} },
  ])('refuses $name as a reorder', ({ body }) => {
    expect(reorderPlaylist.body.safeParse(body).success).toBe(false);
  });

  it('refuses a visibility outside the three', () => {
    expect(createPlaylist.body.safeParse({ title: 'Mix', visibility: 'friends' }).success).toBe(
      false
    );
  });

  it('promises SYSTEM_PLAYLIST_IMMUTABLE as a 400 on the delete', () => {
    expect(deletePlaylist.errors[400]).toContain('SYSTEM_PLAYLIST_IMMUTABLE');
  });
});
