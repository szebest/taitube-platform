import { z } from 'zod';
import { secret } from './env-fields';

export const VoiceEnvSchema = z.object({
  WATCH_PARTY_VOICE_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((val) => val === 'true'),
  LIVEKIT_URL: z.url().default('ws://localhost:7880'),
  LIVEKIT_API_URL: z.url().default('http://localhost:7880'),
  LIVEKIT_API_KEY: secret(),
  LIVEKIT_API_SECRET: secret(),
  WATCH_PARTY_VOICE_MAX_SPEAKERS: z.coerce.number().int().min(1).default(12),
});
