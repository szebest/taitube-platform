import { LIVE_STREAM_STATUSES, liveStreamPath, streamKeyFromPath } from '../live';

describe('@vp/domain: live stream', () => {
  it('spells the stream statuses the way the database enum does', () => {
    expect([...LIVE_STREAM_STATUSES]).toEqual(['IDLE', 'LIVE', 'ENDED']);
  });

  it('publishes a stream key on live/{key}', () => {
    expect(liveStreamPath('abc')).toBe('live/abc');
  });

  it.each([
    { path: 'live/abc', key: 'abc' },
    { path: 'live/', key: null },
    { path: 'live/abc/extra', key: null },
    { path: 'other/abc', key: null },
    { path: 'abc', key: null },
  ])('reads the key from $path', ({ path, key }) => {
    expect(streamKeyFromPath(path)).toBe(key);
  });
});
