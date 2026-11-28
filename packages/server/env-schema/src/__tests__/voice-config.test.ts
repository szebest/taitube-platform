import { AppEnvSchema } from '../app-env';
import { voiceConfig } from '../voice-config';

describe('packages/env-schema: voice config', () => {
  it('reads the keys beside the token lifetime, the gateway timeout and the expiry slack', () => {
    const env = AppEnvSchema.parse({
      DATABASE_URL: 'postgres://db:5432/vp',
      WATCH_PARTY_VOICE_ENABLED: 'true',
      LIVEKIT_API_KEY: 'key',
    });

    expect(voiceConfig(env)).toEqual({
      enabled: true,
      url: 'ws://localhost:7880',
      apiUrl: 'http://localhost:7880',
      apiKey: 'key',
      apiSecret: undefined,
      maxSpeakers: 12,
      tokenTtlSeconds: 600,
      gatewayTimeoutMs: 2000,
      expirySlackMs: 250,
    });
  });
});
