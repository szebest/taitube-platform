export const defaultJobOptions = {
  removeOnComplete: { age: 24 * 3600, count: 5000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

export const stagePolicies = {
  probe: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000, jitter: 0.5 },
    priority: 5,
  },
  'transcode-1080p': {
    attempts: 4,
    backoff: { type: 'exponential', delay: 10000, jitter: 0.5 },
  },
  'transcode-720p': {
    attempts: 4,
    backoff: { type: 'exponential', delay: 10000, jitter: 0.5 },
  },
  'transcode-480p': {
    attempts: 4,
    backoff: { type: 'exponential', delay: 10000, jitter: 0.5 },
  },
  thumbnail: {
    attempts: 4,
    backoff: { type: 'exponential', delay: 5000, jitter: 0.5 },
  },
  package: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000, jitter: 0.5 },
  },
  notify: {
    attempts: 8,
    backoff: { type: 'exponential', delay: 2000, jitter: 0.3 },
  },
  housekeeping: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 60000 },
  },
} as const;
