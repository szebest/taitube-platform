import {
  createPlaylistShareLink,
  getPlaylistStats,
  listPlaylistShareLinks,
  revokePlaylistShareLink,
} from '../playlist-sharing';

describe('packages/api-contracts: playlist sharing', () => {
  it.each([
    { endpoint: listPlaylistShareLinks, method: 'GET', path: '/v1/playlists/:id/share-links' },
    { endpoint: createPlaylistShareLink, method: 'POST', path: '/v1/playlists/:id/share-links' },
    {
      endpoint: revokePlaylistShareLink,
      method: 'DELETE',
      path: '/v1/playlists/:id/share-links/:linkId',
    },
    { endpoint: getPlaylistStats, method: 'GET', path: '/v1/me/playlists/:id/stats' },
  ])('serves $method $path', ({ endpoint, method, path }) => {
    expect(endpoint).toMatchObject({ method, path });
  });

  it.each([
    { expiresIn: '1h', valid: true },
    { expiresIn: '30d', valid: true },
    { expiresIn: 'never', valid: true },
    { expiresIn: '2y', valid: false },
  ])('takes the video expiry presets: $expiresIn is $valid', ({ expiresIn, valid }) => {
    expect(createPlaylistShareLink.body.safeParse({ expiresIn }).success).toBe(valid);
  });

  it.each([
    { range: undefined, parsed: '30d' },
    { range: '7d', parsed: '7d' },
    { range: '90d', parsed: '90d' },
  ])('reads the stats range $range as $parsed', ({ range, parsed }) => {
    expect(getPlaylistStats.query.parse({ range })).toEqual({ range: parsed });
  });

  it('refuses a lifetime range', () => {
    expect(getPlaylistStats.query.safeParse({ range: 'lifetime' }).success).toBe(false);
  });
});
