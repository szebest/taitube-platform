import { createHash } from 'node:crypto';
import { voiceConfig } from '@vp/env-schema';
import { AccessToken } from 'livekit-server-sdk';
import { describeVoiceGatewayContract } from '../../../__tests__/contract/voice-gateway.contract';
import { LiveKitVoiceGateway } from '../../livekit-voice-gateway';

const config = voiceConfig({
  enabled: true,
  url: process.env.LIVEKIT_URL ?? 'ws://localhost:7880',
  apiUrl: process.env.LIVEKIT_API_URL ?? 'http://localhost:7880',
  apiKey: process.env.LIVEKIT_API_KEY ?? 'change-me-livekit-key',
  apiSecret: process.env.LIVEKIT_API_SECRET ?? 'change-me-livekit-secret-0123456789abcdef',
  maxSpeakers: 12,
});

describeVoiceGatewayContract(async () => {
  const { apiKey = '', apiSecret = '' } = config;
  return {
    gateway: new LiveKitVoiceGateway({
      type: 'connection',
      apiUrl: config.apiUrl,
      apiKey,
      apiSecret,
      timeoutMs: config.gatewayTimeoutMs,
    }),
    sign: async (body) => {
      const token = new AccessToken(apiKey, apiSecret);
      token.sha256 = createHash('sha256').update(body).digest('base64');
      return token.toJwt();
    },
    close: async () => {},
  };
});
