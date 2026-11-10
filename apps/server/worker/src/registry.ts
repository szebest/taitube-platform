import type { WorkerStageName } from '@vp/env-schema';
import type { QueueName } from '@vp/job-contracts';
import {
  captions,
  housekeeping,
  live,
  notify,
  packaging,
  probe,
  screen,
  thumbnail,
  transcode,
  type StageDeps,
  type StageProcessor,
} from './stage-processors';

export interface StageDefinition {
  stage: WorkerStageName;
  queue: QueueName;
  concurrency: number;
  lockDurationMs: number;
  lockRenewTimeMs: number;
  stalledIntervalMs: number;
  maxStalledCount: number;
  /** The pod's `terminationGracePeriodSeconds` less the 5 s preStop and a 5 s margin. */
  shutdownTimeoutMs: number;
  createProcessor: (deps: StageDeps) => StageProcessor;
}

interface StageTiming {
  concurrency: number;
  lockDurationMs: number;
  shutdownTimeoutMs: number;
  maxStalledCount?: number;
}

/** Every stage renews its lock at half its length and is checked for stalls every 30 s. */
function stageOf(
  stage: WorkerStageName & QueueName,
  timing: StageTiming,
  createProcessor: StageDefinition['createProcessor']
): StageDefinition {
  return {
    stage,
    queue: stage,
    lockRenewTimeMs: timing.lockDurationMs / 2,
    stalledIntervalMs: 30_000,
    maxStalledCount: 2,
    ...timing,
    createProcessor,
  };
}

const transcodeStage = (stage: WorkerStageName & QueueName, shutdownTimeoutMs: number) =>
  stageOf(stage, { concurrency: 1, lockDurationMs: 120_000, shutdownTimeoutMs }, transcode);

export const STAGE_REGISTRY: { readonly [S in WorkerStageName]: StageDefinition } = {
  probe: stageOf(
    'probe',
    { concurrency: 4, lockDurationMs: 60_000, shutdownTimeoutMs: 50_000 },
    probe
  ),
  'transcode-1080p': transcodeStage('transcode-1080p', 890_000),
  'transcode-720p': transcodeStage('transcode-720p', 590_000),
  'transcode-480p': transcodeStage('transcode-480p', 290_000),
  thumbnail: stageOf(
    'thumbnail',
    { concurrency: 2, lockDurationMs: 60_000, shutdownTimeoutMs: 110_000 },
    thumbnail
  ),
  screen: stageOf(
    'screen',
    { concurrency: 2, lockDurationMs: 120_000, shutdownTimeoutMs: 290_000 },
    screen
  ),
  package: stageOf(
    'package',
    { concurrency: 4, lockDurationMs: 60_000, shutdownTimeoutMs: 110_000 },
    packaging
  ),
  notify: stageOf(
    'notify',
    { concurrency: 8, lockDurationMs: 30_000, shutdownTimeoutMs: 20_000 },
    notify
  ),
  captions: stageOf(
    'captions',
    { concurrency: 1, lockDurationMs: 600_000, shutdownTimeoutMs: 890_000 },
    captions
  ),
  live: stageOf(
    'live',
    { concurrency: 4, lockDurationMs: 60_000, shutdownTimeoutMs: 50_000, maxStalledCount: 10 },
    live
  ),
  housekeeping: stageOf(
    'housekeeping',
    { concurrency: 1, lockDurationMs: 300_000, shutdownTimeoutMs: 50_000 },
    housekeeping
  ),
};
