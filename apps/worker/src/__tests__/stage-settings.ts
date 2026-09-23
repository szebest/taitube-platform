import { asCdnBase, inProcessAppConfig } from '@vp/env-schema';
import { housekeepingTasks } from '../stages/housekeeping/index';

const config = inProcessAppConfig();

/** The configuration a stage reads, at the values `.env.example` gives a local process. */
export const STAGE_SETTINGS = {
  rawBucket: 'raw',
  publicBucket: 'public',
  heartbeatPath: '/tmp/vp/heartbeat',
  cdn: asCdnBase('http://localhost:9000/public'),
  spriteIntervalSec: 5,
  ffmpeg: {
    path: config.worker.ffmpegPath,
    threads: 2,
    preset: 'veryfast',
    gopSeconds: config.worker.gopSeconds,
    hlsSegmentSeconds: config.worker.hlsSegmentSeconds,
    timeoutFactor: config.worker.jobTimeoutFactor,
  },
  ffmpegPath: config.worker.ffmpegPath,
  ffprobePath: config.worker.ffprobePath,
  maxDurationSeconds: config.limits.maxDurationSeconds,
  retentionDays: 7,
  maxInflightPerUser: 3,
  tmpDir: '/tmp/vp',
  segmentUpload: config.worker.segmentUpload,
  housekeeping: config.housekeeping,
  workerId: 'worker-spec',
};

export const TASKS = housekeepingTasks(config.housekeeping);
