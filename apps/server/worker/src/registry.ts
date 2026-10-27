import type {
  CacheClient,
  FlowProducerPort,
  JobQueue,
  MultipartStorage,
  QueueJob,
  ReactionCachePort,
  StorageClient,
  ViewBufferPort,
} from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { AppConfig, WorkerStageName } from '@vp/env-schema';
import type { AnyFailure } from '@vp/errors';
import type { MediaTools } from '@vp/ffmpeg';
import {
  CaptionsJob,
  HousekeepingJob,
  NOTIFY_COMMENT,
  NOTIFY_HEART,
  NOTIFY_PROCESSING,
  NOTIFY_SUBSCRIBERS,
  NotifyCommentJob,
  NotifyHeartJob,
  NotifyJob,
  NotifyProcessingJob,
  NotifySubscribersJob,
  PackageJob,
  ProbeJob,
  type QueueName,
  ThumbnailJob,
  TranscodeJob,
} from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import type { PipelineMetrics } from '@vp/observability';
import { err, type Result } from '@vp/result';
import { invalidField } from '@vp/validation';
import type { SpeechTools } from '@vp/whisper';
import type { ZodType } from 'zod';
import type { Every } from './heartbeat';
import { createCaptionsStage } from './stages/captions/captions-stage';
import { createHousekeepingProcessor } from './stages/housekeeping/index';
import { createNotifyCommentProcessor } from './stages/notifications/notify-comment';
import { createNotifyHeartProcessor } from './stages/notifications/notify-heart';
import { createNotifyProcessingProcessor } from './stages/notifications/notify-processing';
import { createNotifySubscribersProcessor } from './stages/notifications/notify-subscribers';
import { createNotifyProcessor } from './stages/notify';
import { createPackageProcessor } from './stages/package';
import { createProbeProcessor } from './stages/probe';
import { createThumbnailProcessor } from './stages/thumbnail';
import { createTranscodeProcessor } from './stages/transcode';
import { createTranscodeChunkProcessor } from './stages/transcode-chunk';
import { transcodeCollaborators } from './transcode-collaborators';

interface StageDeps {
  config: AppConfig;
  repositories: Repositories;
  storage: StorageClient;
  multipart: MultipartStorage;
  cache: CacheClient;
  reactionCache: ReactionCachePort;
  viewBuffer: ViewBufferPort;
  getQueue: (name: string) => JobQueue;
  flowProducer: FlowProducerPort;
  logger: Logger;
  metrics: PipelineMetrics;
  media: MediaTools;
  speech: SpeechTools;
  workerId: string;
  now: () => number;
  every: Every;
}

export type StageProcessor = (job: QueueJob<unknown>) => Promise<Result<unknown, AnyFailure>>;

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

/**
 * A payload is `unknown` until its contract says otherwise, so each stage reads the one its queue
 * carries here, and a job that does not match fails permanently instead of reaching the stage.
 */
function consuming<T>(
  payload: ZodType<T>,
  process: (job: QueueJob<T>) => Promise<Result<unknown, AnyFailure>>
): StageProcessor {
  return async (job) => {
    const parsed = payload.safeParse(job.data);
    return parsed.success
      ? process({ ...job, data: parsed.data })
      : err(invalidField('data', `${job.name} payload rejected: ${parsed.error.message}`, {}));
  };
}

/** The notify queue carries the SSE status job and the jobs that create notification rows. */
const notify = (d: StageDeps): StageProcessor => {
  const { repositories, logger } = d;
  const status = consuming(
    NotifyJob,
    createNotifyProcessor({
      repositories,
      cache: d.cache,
      metrics: d.metrics,
      workerId: d.workerId,
      logger,
    })
  );
  const byName: Record<string, StageProcessor> = {
    [NOTIFY_SUBSCRIBERS]: consuming(
      NotifySubscribersJob,
      createNotifySubscribersProcessor({ repositories, getQueue: d.getQueue, logger })
    ),
    [NOTIFY_COMMENT]: consuming(
      NotifyCommentJob,
      createNotifyCommentProcessor({ repositories, logger })
    ),
    [NOTIFY_HEART]: consuming(NotifyHeartJob, createNotifyHeartProcessor({ repositories, logger })),
    [NOTIFY_PROCESSING]: consuming(
      NotifyProcessingJob,
      createNotifyProcessingProcessor({ repositories, logger })
    ),
  };
  return (job) => (byName[job.name] ?? status)(job);
};

const probe = (d: StageDeps) =>
  consuming(
    ProbeJob,
    createProbeProcessor({
      repositories: d.repositories,
      storage: d.storage,
      media: d.media,
      metrics: d.metrics,
      rawBucket: d.config.buckets.raw,
      workerId: d.workerId,
      logger: d.logger,
      tmpDir: d.config.worker.tmpDir,
      ffprobePath: d.config.worker.ffprobePath,
      maxDurationSeconds: d.config.limits.maxDurationSeconds,
      captions: d.config.captions,
      getQueue: d.getQueue,
      flowProducer: d.flowProducer,
    })
  );

const transcode = (d: StageDeps) => {
  const ffmpeg = {
    path: d.config.worker.ffmpegPath,
    threads: d.config.worker.ffmpegThreads,
    preset: d.config.worker.x264Preset,
    gopSeconds: d.config.worker.gopSeconds,
    hlsSegmentSeconds: d.config.worker.hlsSegmentSeconds,
    timeoutFactor: d.config.worker.jobTimeoutFactor,
    minTimeoutMs: d.config.worker.ffmpegProcess.minTranscodeTimeoutMs,
    limits: d.config.worker.ffmpegProcess,
  };
  const shared = {
    repositories: d.repositories,
    storage: d.storage,
    media: d.media,
    metrics: d.metrics,
    rawBucket: d.config.buckets.raw,
    workerId: d.workerId,
    logger: d.logger,
    tmpDir: d.config.worker.tmpDir,
    ffmpeg,
  };
  const rendition = createTranscodeProcessor({ ...shared, ...transcodeCollaborators(d) });
  const chunk = createTranscodeChunkProcessor(shared);
  return consuming(TranscodeJob, (job) =>
    job.data.chunkIndex === undefined ? rendition(job) : chunk(job)
  );
};

const captions = (d: StageDeps) => consuming(CaptionsJob, createCaptionsStage(d));

const transcodeStage = (stage: WorkerStageName & QueueName, shutdownTimeoutMs: number) => ({
  stage,
  queue: stage,
  concurrency: 1,
  lockDurationMs: 120_000,
  lockRenewTimeMs: 60_000,
  stalledIntervalMs: 30_000,
  maxStalledCount: 2,
  shutdownTimeoutMs,
  createProcessor: transcode,
});

export const STAGE_REGISTRY: { readonly [S in WorkerStageName]: StageDefinition } = {
  probe: {
    stage: 'probe',
    queue: 'probe',
    concurrency: 4,
    lockDurationMs: 60_000,
    lockRenewTimeMs: 30_000,
    stalledIntervalMs: 30_000,
    maxStalledCount: 2,
    shutdownTimeoutMs: 50_000,
    createProcessor: probe,
  },
  'transcode-1080p': transcodeStage('transcode-1080p', 890_000),
  'transcode-720p': transcodeStage('transcode-720p', 590_000),
  'transcode-480p': transcodeStage('transcode-480p', 290_000),
  thumbnail: {
    stage: 'thumbnail',
    queue: 'thumbnail',
    concurrency: 2,
    lockDurationMs: 60_000,
    lockRenewTimeMs: 30_000,
    stalledIntervalMs: 30_000,
    maxStalledCount: 2,
    shutdownTimeoutMs: 110_000,
    createProcessor: (d) =>
      consuming(
        ThumbnailJob,
        createThumbnailProcessor({
          repositories: d.repositories,
          storage: d.storage,
          media: d.media,
          metrics: d.metrics,
          rawBucket: d.config.buckets.raw,
          publicBucket: d.config.buckets.public,
          workerId: d.workerId,
          logger: d.logger,
          tmpDir: d.config.worker.tmpDir,
          ffmpegPath: d.config.worker.ffmpegPath,
          sprite: d.config.sprite,
          ffmpegProcess: d.config.worker.ffmpegProcess,
        })
      ),
  },
  package: {
    stage: 'package',
    queue: 'package',
    concurrency: 4,
    lockDurationMs: 60_000,
    lockRenewTimeMs: 30_000,
    stalledIntervalMs: 30_000,
    maxStalledCount: 2,
    shutdownTimeoutMs: 110_000,
    createProcessor: (d) =>
      consuming(
        PackageJob,
        createPackageProcessor({
          repositories: d.repositories,
          storage: d.storage,
          metrics: d.metrics,
          publicBucket: d.config.buckets.public,
          cdn: d.config.cdn,
          workerId: d.workerId,
          logger: d.logger,
          now: d.now,
          getQueue: d.getQueue,
        })
      ),
  },
  notify: {
    stage: 'notify',
    queue: 'notify',
    concurrency: 8,
    lockDurationMs: 30_000,
    lockRenewTimeMs: 15_000,
    stalledIntervalMs: 30_000,
    maxStalledCount: 2,
    shutdownTimeoutMs: 20_000,
    createProcessor: notify,
  },
  captions: {
    stage: 'captions',
    queue: 'captions',
    concurrency: 1,
    lockDurationMs: 600_000,
    lockRenewTimeMs: 300_000,
    stalledIntervalMs: 30_000,
    maxStalledCount: 2,
    shutdownTimeoutMs: 890_000,
    createProcessor: captions,
  },
  housekeeping: {
    stage: 'housekeeping',
    queue: 'housekeeping',
    concurrency: 1,
    lockDurationMs: 300_000,
    lockRenewTimeMs: 150_000,
    stalledIntervalMs: 30_000,
    maxStalledCount: 2,
    shutdownTimeoutMs: 50_000,
    createProcessor: (d) =>
      consuming(
        HousekeepingJob,
        createHousekeepingProcessor({
          repositories: d.repositories,
          storage: d.storage,
          multipart: d.multipart,
          reactionCache: d.reactionCache,
          viewBuffer: d.viewBuffer,
          getQueue: d.getQueue,
          workerId: d.workerId,
          metrics: d.metrics,
          now: d.now,
          logger: d.logger,
          rawBucket: d.config.buckets.raw,
          publicBucket: d.config.buckets.public,
          retentionDays: d.config.limits.rawRetentionDays,
          maxInflightPerUser: d.config.limits.maxInflightPerUser,
          tmpDir: d.config.worker.tmpDir,
          housekeeping: d.config.housekeeping,
          views: d.config.views,
          captions: d.config.captions,
        })
      ),
  },
};
