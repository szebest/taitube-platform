import { libraryKeys, playlistQueryOptions } from '../library-keys';

const PLAYLIST_ID = '0190c3a0-5e1d-7000-8000-00000000a001';

describe('apps/client/web: library keys', () => {
  it.each([
    { key: 'history', value: libraryKeys.history() },
    { key: 'playlists', value: libraryKeys.playlists() },
    { key: 'playlist', value: libraryKeys.playlist(PLAYLIST_ID) },
    { key: 'saveTargets', value: libraryKeys.saveTargets(PLAYLIST_ID) },
    { key: 'uploads', value: libraryKeys.uploads(PLAYLIST_ID) },
  ])('scopes $key under the library', ({ value }) => {
    expect(value.slice(0, libraryKeys.all.length)).toEqual(libraryKeys.all);
  });

  it('keys a playlist under the playlist details, so one invalidation reaches every open playlist', () => {
    expect(playlistQueryOptions({} as never, PLAYLIST_ID).queryKey).toEqual([
      ...libraryKeys.playlistDetails(),
      PLAYLIST_ID,
    ]);
  });
});
