import { videoStatusChanged } from '../user-event';

describe('domain: user event', () => {
  it('announces a video status as a video.processing status change', () => {
    expect(videoStatusChanged('v1', 'READY')).toEqual({
      type: 'video.processing',
      payload: { videoId: 'v1', change: { kind: 'status', status: 'READY' } },
    });
  });
});
