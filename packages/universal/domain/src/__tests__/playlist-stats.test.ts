import { NO_PLAYLIST_COUNTS, type PlaylistCount, mergePlaylistCounts } from '../playlist-stats';

const count = (overrides: Partial<PlaylistCount>): PlaylistCount => ({
  ...NO_PLAYLIST_COUNTS,
  playlistId: 'p1',
  videoId: null,
  viewDate: '2026-11-20',
  ...overrides,
});

describe('domain: playlist stats', () => {
  it('adds the counts of one playlist, video and day, and keeps the others apart', () => {
    expect(
      mergePlaylistCounts([
        count({ opens: 1 }),
        count({ opens: 2, follows: 1 }),
        count({ videoId: 'v1', plays: 1 }),
        count({ videoId: 'v1', plays: 2 }),
        count({ viewDate: '2026-11-21', forks: 1 }),
      ])
    ).toEqual([
      count({ opens: 3, follows: 1 }),
      count({ videoId: 'v1', plays: 3 }),
      count({ viewDate: '2026-11-21', forks: 1 }),
    ]);
  });
});
