import { createHash } from 'node:crypto';
import { AccessToken } from 'livekit-server-sdk';
import { describeVoiceGatewayContract } from '../../../__tests__/contract/voice-gateway.contract';
import { LiveKitVoiceGateway } from '../../livekit-voice-gateway';

const API_URL = process.env.LIVEKIT_API_URL ?? 'http://localhost:7880';
const API_KEY = process.env.LIVEKIT_API_KEY ?? 'change-me-livekit-key';
const API_SECRET = process.env.LIVEKIT_API_SECRET ?? 'change-me-livekit-secret-0123456789abcdef';

describeVoiceGatewayContract(async () => ({
  gateway: new LiveKitVoiceGateway({
    type: 'connection',
    apiUrl: API_URL,
    apiKey: API_KEY,
    apiSecret: API_SECRET,
    timeoutMs: 2000,
  }),
  sign: async (body) => {
    const token = new AccessToken(API_KEY, API_SECRET);
    token.sha256 = createHash('sha256').update(body).digest('base64');
    return token.toJwt();
  },
  close: async () => {},
}));
