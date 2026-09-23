import { asCdnBase } from '@vp/env-schema';

/** The configuration a stage reads, at the values `.env.example` gives a local process. */
export const STAGE_SETTINGS = {
  rawBucket: 'raw',
  publicBucket: 'public',
  heartbeatPath: '/tmp/vp/heartbeat',
  cdn: asCdnBase('http://localhost:9000/public'),
  spriteIntervalSec: 5,
  ffmpeg: { threads: 2, preset: 'veryfast' },
  retentionDays: 7,
  maxInflightPerUser: 3,
  tmpDir: '/tmp/vp',
};
