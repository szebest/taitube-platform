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
}

export function voiceConfig(
  keys: Pick<VoiceConfig, 'enabled' | 'url' | 'apiUrl' | 'apiKey' | 'apiSecret' | 'maxSpeakers'>
): VoiceConfig {
  return { ...keys, ...VOICE };
}
