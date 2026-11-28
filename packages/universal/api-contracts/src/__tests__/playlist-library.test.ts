import {
  followPlaylist,
  forkPlaylist,
  freezePlaylist,
  listFollowedPlaylists,
  pinPlaylist,
  unfollowPlaylist,
  unpinPlaylist,
} from '../playlist-library';

describe('packages/api-contracts: playlist library', () => {
  it.each([
    { endpoint: pinPlaylist, method: 'PUT', path: '/v1/playlists/:id/pin', status: 204 },
    { endpoint: unpinPlaylist, method: 'DELETE', path: '/v1/playlists/:id/pin', status: 204 },
    { endpoint: followPlaylist, method: 'PUT', path: '/v1/playlists/:id/follow', status: 204 },
    { endpoint: unfollowPlaylist, method: 'DELETE', path: '/v1/playlists/:id/follow', status: 204 },
    {
      endpoint: listFollowedPlaylists,
      method: 'GET',
      path: '/v1/me/playlists/following',
      status: 200,
    },
    { endpoint: forkPlaylist, method: 'POST', path: '/v1/playlists/:id/fork', status: 201 },
    { endpoint: freezePlaylist, method: 'POST', path: '/v1/playlists/:id/freeze', status: 201 },
  ])('serves $method $path with $status', ({ endpoint, method, path, status }) => {
    expect(endpoint).toMatchObject({ method, path, status });
  });

  it.each([
    { endpoint: pinPlaylist, code: 'PLAYLIST_PIN_LIMIT' },
    { endpoint: freezePlaylist, code: 'PLAYLIST_NOT_SMART' },
  ])('promises $code as a 409', ({ endpoint, code }) => {
    expect(endpoint.errors[409]).toContain(code);
  });

  it('shows a followed playlist gone private as null', () => {
    const item = {
      playlistId: '00000000-0000-7000-8000-00000000f001',
      followedAt: '2026-11-01T00:00:00.000Z',
      playlist: null,
    };

    expect(
      listFollowedPlaylists.result.safeParse({ items: [item], nextCursor: null }).success
    ).toBe(true);
  });
});
