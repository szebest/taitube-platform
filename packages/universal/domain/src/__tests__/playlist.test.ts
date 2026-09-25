import { PLAYLIST_VISIBILITIES, WATCH_LATER_TITLE } from '../playlist';

describe('@vp/domain: playlist', () => {
  it('offers the three visibilities a video has', () => {
    expect([...PLAYLIST_VISIBILITIES].sort()).toEqual(['private', 'public', 'unlisted']);
  });

  it('names the system playlist the way the watch page labels it', () => {
    expect(WATCH_LATER_TITLE).toBe('Watch Later');
  });
});
