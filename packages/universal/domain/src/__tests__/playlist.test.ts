import {
  PLAYLIST_VISIBILITIES,
  WATCH_LATER_TITLE,
  clampSegment,
  unwatchedFirstKey,
} from '../playlist';

describe('@vp/domain: playlist', () => {
  it('offers the three visibilities a video has', () => {
    expect([...PLAYLIST_VISIBILITIES].sort()).toEqual(['private', 'public', 'unlisted']);
  });

  it('names the system playlist the way the watch page labels it', () => {
    expect(WATCH_LATER_TITLE).toBe('Watch Later');
  });

  it.each([
    {
      scenario: 'inside the video',
      segment: { startMs: 1000, endMs: 5000 },
      clamped: { startMs: 1000, endMs: 5000 },
    },
    {
      scenario: 'open at both ends',
      segment: { startMs: null, endMs: null },
      clamped: { startMs: null, endMs: null },
    },
    {
      scenario: 'ending past a shorter replacement',
      segment: { startMs: 1000, endMs: 20_000 },
      clamped: { startMs: 1000, endMs: null },
    },
    {
      scenario: 'starting past it',
      segment: { startMs: 12_000, endMs: 20_000 },
      clamped: { startMs: null, endMs: null },
    },
  ])('clamps a segment $scenario to a 10 second video', ({ segment, clamped }) => {
    expect(clampSegment(segment, 10_000)).toEqual(clamped);
  });

  it('sorts every unwatched item before every watched one, each run in playlist order', () => {
    const keys = [
      unwatchedFirstKey(true, 0),
      unwatchedFirstKey(false, 7),
      unwatchedFirstKey(false, 2),
      unwatchedFirstKey(true, 1),
    ];

    expect([...keys].sort((a, b) => a - b)).toEqual([keys[2], keys[1], keys[0], keys[3]]);
  });
});
