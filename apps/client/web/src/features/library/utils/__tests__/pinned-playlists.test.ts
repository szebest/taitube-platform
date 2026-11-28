import { ownedPlaylist } from '#app/__tests__/library-fixtures';
import { pinnedPlaylists } from '../pinned-playlists';

describe('apps/client/web: pinnedPlaylists', () => {
  it('keeps the pinned playlists, the oldest pin first', () => {
    const pinned = pinnedPlaylists([
      ownedPlaylist(1, { pinnedAt: '2026-03-09T10:00:00.000Z' }),
      ownedPlaylist(2),
      ownedPlaylist(3, { pinnedAt: '2026-03-01T10:00:00.000Z' }),
    ]);

    expect(pinned.map(({ title }) => title)).toEqual(['Playlist 3', 'Playlist 1']);
  });
});
