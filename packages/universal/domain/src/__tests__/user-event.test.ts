import {
  captionsFailed,
  captionsReady,
  preferencesUpdated,
  videoStatusChanged,
} from '../user-event';

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

  it('announces a ready track with its language and kind', () => {
    expect(captionsReady('v1', { id: 'c1', language: 'en', kind: 'auto' })).toEqual({
      type: 'captions.ready',
      payload: { videoId: 'v1', track: { id: 'c1', language: 'en', kind: 'auto' } },
    });
  });

  it('announces a failed track with the reason it failed', () => {
    expect(captionsFailed('v1', 'c1', 'WHISPER_FAILED')).toEqual({
      type: 'captions.failed',
      payload: { videoId: 'v1', captionId: 'c1', reason: 'WHISPER_FAILED' },
    });
  });
});
