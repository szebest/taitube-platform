import {
  LIVE_STREAM_STATUSES,
  type LiveStream,
  liveStreamCarryOver,
  liveStreamPath,
  streamKeyFromPath,
} from '../live';

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

  it('hands the next broadcast the credentials and settings, and nothing of the last one', () => {
    const ended: LiveStream = {
      id: 'stream-1',
      channelId: 'channel-1',
      title: 'Speedrun',
      description: 'Any%',
      streamKey: 'key',
      status: 'ENDED',
      visibility: 'unlisted',
      archiveVisibility: 'private',
      overlayToken: 'overlay',
      controlToken: 'control',
      currentViewers: 12,
      chatSlowModeSeconds: 30,
      chatSubscribersOnly: true,
      markers: [{ offsetMs: 1000, label: 'start' }],
      startedAt: new Date(0),
      endedAt: new Date(1),
      stopRequestedAt: new Date(1),
      videoId: 'video-1',
      createdAt: new Date(0),
      updatedAt: new Date(1),
    };

    expect(liveStreamCarryOver(ended)).toEqual({
      channelId: 'channel-1',
      title: 'Speedrun',
      description: 'Any%',
      visibility: 'unlisted',
      archiveVisibility: 'private',
      chatSlowModeSeconds: 30,
      chatSubscribersOnly: true,
      streamKey: 'key',
      overlayToken: 'overlay',
      controlToken: 'control',
    });
  });
});
