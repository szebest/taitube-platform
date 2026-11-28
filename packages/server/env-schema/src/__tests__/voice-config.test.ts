import { voiceConfig } from '../voice-config';

describe('packages/env-schema: voice config', () => {
  it('keeps the keys beside the token lifetime and the gateway timeout', () => {
    const keys = {
      enabled: true,
      url: 'ws://localhost:7880',
      apiUrl: 'http://livekit:7880',
      apiKey: 'key',
      apiSecret: undefined,
      maxSpeakers: 12,
    };

    expect(voiceConfig(keys)).toEqual({ ...keys, tokenTtlSeconds: 600, gatewayTimeoutMs: 2000 });
  });
});
