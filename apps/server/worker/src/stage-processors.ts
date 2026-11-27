import type { AnyFailure } from '@kit/errors';
import type { Logger } from '@kit/logger';
import type { Result } from '@kit/result';
import type {
  CacheClient,
  FlowProducerPort,
  FrameClassifier,
  JobQueue,
  LiveGatewayPort,
  MultipartStorage,
  QueueJob,
  ReactionCachePort,
  StorageClient,
  ViewBufferPort,
  WebhookDispatcher,
} from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { AppConfig } from '@vp/env-schema';
import type { MediaTools } from '@vp/ffmpeg';
import type { FingerprintTools } from '@vp/fingerprint';
import {
  APPLY_EDITS,
  ApplyEditsJob,
  CaptionsJob,
  EXPORT_DATA,
  ExportJob,
  HousekeepingJob,
  LiveJob,
  NotifyJob,
  PackageJob,
  ProbeJob,
  ScreenJob,
  TranscodeJob,
} from '@vp/job-contracts';
import type { PipelineMetrics } from '@vp/pipeline-metrics';
import type { SpeechTools } from '@vp/whisper';
import { consuming } from './consuming';
import type { Every } from './heartbeat';
import { liveCollaborators } from './live-collaborators';
import { createApplyEditsProcessor } from './stages/apply-edits/apply-edits-stage';
import { createCaptionsStage } from './stages/captions/captions-stage';
import { createExportProcessor } from './stages/exports/export-stage';
import { createHousekeepingProcessor } from './stages/housekeeping/index';
import { createLiveStage } from './stages/live/live-stage';
import { notificationProcessors } from './stages/notifications/notification-processors';
import { playlistNotifications } from './stages/notifications/playlist-notifications';
import { createNotifyProcessor } from './stages/notify';
import { createPackageProcessor } from './stages/package';
import { createProbeProcessor } from './stages/probe';
import { createScreenProcessor } from './stages/screen/screen-stage';
import { createThumbnailQueueStage } from './stages/thumbnail-queue';
import { createTranscodeProcessor } from './stages/transcode';
import { createTranscodeChunkProcessor } from './stages/transcode-chunk';
import { transcodeCollaborators } from './transcode-collaborators';

export interface StageDeps {
  config: AppConfig;
  repositories: Repositories;
  storage: StorageClient;
  multipart: MultipartStorage;
  cache: CacheClient;
  reactionCache: ReactionCachePort;
  viewBuffer: ViewBufferPort;
  getQueue: (name: string) => JobQueue;
  flowProducer: FlowProducerPort;
  webhookDispatcher: WebhookDispatcher;
  liveGateway: LiveGatewayPort;
  logger: Logger;
  metrics: PipelineMetrics;
  media: MediaTools;
  speech: SpeechTools;
  fingerprint: FingerprintTools;
  /** Built on first call, so only the `screen` stage constructs, verifies and starts the model. */
  frameClassifier: () => FrameClassifier;
  workerId: string;
  now: () => number;
  every: Every;
}

export type StageProcessor = (job: QueueJob<unknown>) => Promise<Result<unknown, AnyFailure>>;

/** The notify queue carries the SSE status job, the jobs that create notification rows and exports. */
export const notify = (d: StageDeps): StageProcessor => {
  const { repositories, logger } = d;
  const status = consuming(
    NotifyJob,
    createNotifyProcessor({
      repositories,
      cache: d.cache,
      metrics: d.metrics,
      workerId: d.workerId,
      logger,
      webhookDispatcher: d.webhookDispatcher,
    })
  );
  const byName: Record<string, StageProcessor> = {
    ...notificationProcessors({
      repositories,
      logger,
      getQueue: d.getQueue,
      now: d.now,
      webhookDispatcher: d.webhookDispatcher,
    }),
    ...playlistNotifications({ repositories, logger, now: d.now }),
    [EXPORT_DATA]: consuming(
      ExportJob,
      createExportProcessor({
        repositories,
        storage: d.storage,
        webhookDispatcher: d.webhookDispatcher,
        bucket: d.config.buckets.raw,
        tmpDir: d.config.worker.tmpDir,
        logger,
        now: d.now,
      })
    ),
  };
  return (job) => (byName[job.name] ?? status)(job);
};

export const probe = (d: StageDeps) =>
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
      screening: d.config.screening,
      getQueue: d.getQueue,
      flowProducer: d.flowProducer,
    })
  );

/** The transcode queues carry a rendition or a chunk of one; the 1080p queue also carries apply-edits renders. */
export const transcode = (d: StageDeps) => {
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
  const render = consuming(
    ApplyEditsJob,
    createApplyEditsProcessor({
      ...shared,
      publicBucket: d.config.buckets.public,
      ffprobePath: d.config.worker.ffprobePath,
      maxDurationSeconds: d.config.limits.maxDurationSeconds,
      now: d.now,
    })
  );
  const encode = consuming(TranscodeJob, (job) =>
    job.data.chunkIndex === undefined ? rendition(job) : chunk(job)
  );
  return (job: QueueJob<unknown>) => (job.name === APPLY_EDITS ? render(job) : encode(job));
};

export const captions = (d: StageDeps) => consuming(CaptionsJob, createCaptionsStage(d));

export const live = (d: StageDeps) =>
  consuming(LiveJob, createLiveStage({ ...d, ...liveCollaborators(d) }));

export const thumbnail = (d: StageDeps) =>
  createThumbnailQueueStage({ ...d, progressReporter: transcodeCollaborators(d).progressReporter });

export const screen = (d: StageDeps) =>
  consuming(
    ScreenJob,
    createScreenProcessor({
      repositories: d.repositories,
      storage: d.storage,
      fingerprint: d.fingerprint,
      classifier: d.frameClassifier(),
      metrics: d.metrics,
      rawBucket: d.config.buckets.raw,
      workerId: d.workerId,
      logger: d.logger,
      tmpDir: d.config.worker.tmpDir,
      ffmpegPath: d.config.worker.ffmpegPath,
      fpcalcPath: d.config.worker.fpcalcPath,
      ffmpegProcess: d.config.worker.ffmpegProcess,
      screening: d.config.screening,
      now: d.now,
      every: d.every,
    })
  );

export const packaging = (d: StageDeps) =>
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
      screeningThresholdVersion: d.config.screening.thresholds.version,
    })
  );

export const housekeeping = (d: StageDeps) =>
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
  );
