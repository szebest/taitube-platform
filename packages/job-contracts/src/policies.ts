export const defaultJobOptions = {
  removeOnComplete: { age: 24 * 3600, count: 5000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

export const stagePolicies = {
  probe: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    priority: 5,
  },
  'transcode-1080p': {
    attempts: 4,
    backoff: { type: 'exponential', delay: 10000 },
  },
  'transcode-720p': {
    attempts: 4,
    backoff: { type: 'exponential', delay: 10000 },
  },
  'transcode-480p': {
    attempts: 4,
    backoff: { type: 'exponential', delay: 10000 },
  },
  thumbnail: {
    attempts: 4,
    backoff: { type: 'exponential', delay: 5000 },
  },
  package: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
  },
  notify: {
    attempts: 8,
    backoff: { type: 'exponential', delay: 2000 },
  },
  housekeeping: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 60000 },
  },
} as const;
