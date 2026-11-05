import { liveConfig } from '../live-config';

describe('packages/env-schema: live config', () => {
  it('keeps the live keys and packages two-second segments of half-second parts', () => {
    const keys = {
      hookSecret: undefined,
      ingestUrl: 'rtsp://mediamtx:8554',
      gatewayApiUrl: 'http://mediamtx:9997',
      rtmpPublicUrl: 'rtmp://localhost:1935/live',
      whipPublicUrl: 'http://localhost:8889/live',
    };

    expect(liveConfig(keys)).toMatchObject({
      ...keys,
      gatewayTimeoutMs: 2000,
      packaging: { segmentMs: 2000, partMs: 500 },
    });
  });
});
