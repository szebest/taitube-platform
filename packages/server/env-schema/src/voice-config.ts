import type { AppEnv } from './app-env';
import { VOICE } from './tuning';

export interface VoiceConfig {
  enabled: boolean;
  /** The WebSocket URL a browser connects to. */
  url: string;
  /** The media server's API origin, server to server. */
  apiUrl: string;
  /** Absent refuses every token and webhook: a media server nobody keyed is not trusted. */
  apiKey: string | undefined;
  apiSecret: string | undefined;
  maxSpeakers: number;
  tokenTtlSeconds: number;
  gatewayTimeoutMs: number;
  /** How long past a mute's expiry the grants are recomputed, so the clock has passed it. */
  expirySlackMs: number;
}

type VoiceEnv = Pick<
  AppEnv,
  | 'WATCH_PARTY_VOICE_ENABLED'
  | 'LIVEKIT_URL'
  | 'LIVEKIT_API_URL'
  | 'LIVEKIT_API_KEY'
  | 'LIVEKIT_API_SECRET'
  | 'WATCH_PARTY_VOICE_MAX_SPEAKERS'
>;

export function voiceConfig(env: VoiceEnv): VoiceConfig {
  return {
    enabled: env.WATCH_PARTY_VOICE_ENABLED,
    url: env.LIVEKIT_URL,
    apiUrl: env.LIVEKIT_API_URL,
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
    maxSpeakers: env.WATCH_PARTY_VOICE_MAX_SPEAKERS,
    ...VOICE,
  };
}
