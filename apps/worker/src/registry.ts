export interface StageConfig {
  queue: string;
  concurrency: number;
  lockDurationMs: number;
  shutdownTimeoutMs: number;
}

export const STAGE_REGISTRY: Record<string, StageConfig> = {
  probe: {
    queue: 'probe',
    concurrency: 5,
    lockDurationMs: 60000,
    shutdownTimeoutMs: 10000,
  },
  'transcode-1080p': {
    queue: 'transcode-1080p',
    concurrency: 1,
    lockDurationMs: 300000,
    shutdownTimeoutMs: 900000,
  },
  'transcode-720p': {
    queue: 'transcode-720p',
    concurrency: 1,
    lockDurationMs: 300000,
    shutdownTimeoutMs: 900000,
  },
  'transcode-480p': {
    queue: 'transcode-480p',
    concurrency: 2,
    lockDurationMs: 300000,
    shutdownTimeoutMs: 900000,
  },
  thumbnail: {
    queue: 'thumbnail',
    concurrency: 4,
    lockDurationMs: 60000,
    shutdownTimeoutMs: 15000,
  },
  package: {
    queue: 'package',
    concurrency: 4,
    lockDurationMs: 60000,
    shutdownTimeoutMs: 15000,
  },
  notify: {
    queue: 'notify',
    concurrency: 10,
    lockDurationMs: 30000,
    shutdownTimeoutMs: 5000,
  },
  housekeeping: {
    queue: 'housekeeping',
    concurrency: 1,
    lockDurationMs: 120000,
    shutdownTimeoutMs: 10000,
  },
};
