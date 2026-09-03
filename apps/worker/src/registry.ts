import { QUEUES, type QueueName } from '@vp/job-contracts';

export interface StageConfig {
  stage: string;
  queue: QueueName;
  concurrency: number;
  lockDurationMs: number;
  lockRenewTimeMs: number;
  stalledIntervalMs: number;
  maxStalledCount: number;
  shutdownTimeoutMs: number;
}

export function validateQueueName(name: string): QueueName {
  if (name.includes(':')) {
    throw new Error(`Queue name must not contain ':' (got "${name}")`);
  }
  if (!QUEUES.includes(name as QueueName)) {
    throw new Error(`Unknown queue name "${name}". Allowed queues are: ${QUEUES.join(', ')}`);
  }
  return name as QueueName;
}

export function validateJobId(jobId: string): string {
  if (jobId.includes(':')) {
    throw new Error(
      `Job ID must not contain ':' (got "${jobId}"). Use '--' separator per SDD §9.1`
    );
  }
  return jobId;
}

export const STAGE_REGISTRY: Record<string, StageConfig> = {
  probe: {
    stage: 'probe',
    queue: 'probe',
    concurrency: 4, // SDD §9.1: probe concurrency 4
    lockDurationMs: 60000,
    lockRenewTimeMs: 30000,
    stalledIntervalMs: 30000,
    maxStalledCount: 2,
    shutdownTimeoutMs: 10000,
  },
  'transcode-1080p': {
    stage: 'transcode-1080p',
    queue: 'transcode-1080p',
    concurrency: 1, // SDD §9.4: transcode = 1 job per pod
    lockDurationMs: 120000,
    lockRenewTimeMs: 60000,
    stalledIntervalMs: 30000,
    maxStalledCount: 2,
    shutdownTimeoutMs: 30000,
  },
  'transcode-720p': {
    stage: 'transcode-720p',
    queue: 'transcode-720p',
    concurrency: 1,
    lockDurationMs: 120000,
    lockRenewTimeMs: 60000,
    stalledIntervalMs: 30000,
    maxStalledCount: 2,
    shutdownTimeoutMs: 30000,
  },
  'transcode-480p': {
    stage: 'transcode-480p',
    queue: 'transcode-480p',
    concurrency: 1,
    lockDurationMs: 120000,
    lockRenewTimeMs: 60000,
    stalledIntervalMs: 30000,
    maxStalledCount: 2,
    shutdownTimeoutMs: 30000,
  },
  thumbnail: {
    stage: 'thumbnail',
    queue: 'thumbnail',
    concurrency: 2,
    lockDurationMs: 60000,
    lockRenewTimeMs: 30000,
    stalledIntervalMs: 30000,
    maxStalledCount: 2,
    shutdownTimeoutMs: 15000,
  },
  package: {
    stage: 'package',
    queue: 'package',
    concurrency: 4,
    lockDurationMs: 60000,
    lockRenewTimeMs: 30000,
    stalledIntervalMs: 30000,
    maxStalledCount: 2,
    shutdownTimeoutMs: 15000,
  },
  notify: {
    stage: 'notify',
    queue: 'notify',
    concurrency: 8,
    lockDurationMs: 30000,
    lockRenewTimeMs: 15000,
    stalledIntervalMs: 30000,
    maxStalledCount: 2,
    shutdownTimeoutMs: 5000,
  },
  housekeeping: {
    stage: 'housekeeping',
    queue: 'housekeeping',
    concurrency: 1,
    lockDurationMs: 300000,
    lockRenewTimeMs: 150000,
    stalledIntervalMs: 30000,
    maxStalledCount: 2,
    shutdownTimeoutMs: 10000,
  },
};
