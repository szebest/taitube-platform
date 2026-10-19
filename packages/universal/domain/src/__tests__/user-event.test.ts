import { preferencesUpdated, videoStatusChanged } from '../user-event';

describe('domain: user event', () => {
  it('announces a video status as a video.processing status change', () => {
    expect(videoStatusChanged('v1', 'READY')).toEqual({
      type: 'video.processing',
      payload: { videoId: 'v1', change: { kind: 'status', status: 'READY' } },
    });
  });

  it('announces a preferences save with the sections it changed and the version it made', () => {
    expect(preferencesUpdated(['playback', 'privacy'], 4)).toEqual({
      type: 'preferences.updated',
      payload: { sections: ['playback', 'privacy'], version: 4 },
    });
  });
});
