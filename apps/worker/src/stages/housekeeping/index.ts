import type {
  JobQueue,
  MultipartStorage,
  QueueJob,
  ReactionCachePort,
  StorageClient,
  ViewBufferPort,
} from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { AppConfig } from '@vp/env-schema';
import type { AnyFailure } from '@vp/errors';
import type { HousekeepingJob, QueueName } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import type { PipelineMetrics } from '@vp/observability';
import { type Result, assertNever, ok } from '@vp/result';
import { runExpireRaw } from './expire-raw';
import { runFlushVideoViews } from './flush-video-views';
import { runPurgeDeleted } from './purge-deleted';
import { runReconcileProcessing } from './reconcile-processing';
import { runReconcileReactionCounters } from './reconcile-reaction-counters';
import { runReconcileUploads } from './reconcile-uploads';
import { runTmpSweep } from './tmp-sweep';

export * from './reconcile-uploads';
export * from './reconcile-processing';
export * from './reconcile-reaction-counters';
export * from './purge-deleted';
export * from './expire-raw';
export * from './tmp-sweep';
export * from './outbox-relay';
export * from './flush-video-views';

interface HousekeepingSettings {
  rawBucket: string;
  publicBucket: string;
  retentionDays: number;
  maxInflightPerUser: number;
  tmpDir: string;
  housekeeping: AppConfig['housekeeping'];
  views: AppConfig['views'];
}

export interface HousekeepingProcessorOptions extends HousekeepingSettings {
  repositories: Repositories;
  storage: StorageClient;
  multipart: MultipartStorage;
  reactionCache: ReactionCachePort;
  viewBuffer: ViewBufferPort;
  getQueue: (name: QueueName) => JobQueue;
  workerId: string;
  metrics: PipelineMetrics;
  now: () => number;
  logger?: Logger;
}

export function housekeepingTasks(housekeeping: AppConfig['housekeeping']) {
  return {
    uploads: {
      uploadingThresholdMs: housekeeping.stuckUploadingAfterMs,
      uploadedThresholdMs: housekeeping.stuckUploadedAfterMs,
      scanLimit: housekeeping.scanLimit,
    },
    processing: {
      thresholdMs: housekeeping.stuckProcessingAfterMs,
      scanLimit: housekeeping.scanLimit,
    },
    purge: { thresholdMs: housekeeping.purgeDeletedAfterMs, scanLimit: housekeeping.scanLimit },
    expire: { scanLimit: housekeeping.scanLimit },
    tmpSweep: { thresholdMs: housekeeping.tmpSweepAfterMs },
    reactions: { limit: housekeeping.reactionReconcileLimit },
    outbox: {
      batchSize: housekeeping.outboxBatchSize,
      intervalMs: housekeeping.outboxRelayIntervalMs,
    },
  } as const;
}

export function createHousekeepingProcessor(
  options: HousekeepingProcessorOptions
): (job: QueueJob<HousekeepingJob>) => Promise<Result<unknown, AnyFailure>> {
  const { repositories, storage, multipart, reactionCache, viewBuffer, getQueue, workerId } =
    options;
  const { metrics, now, logger } = options;
  const { rawBucket, publicBucket, retentionDays, maxInflightPerUser, tmpDir, housekeeping } =
    options;
  const probeQueue = getQueue('probe');
  const tasks = housekeepingTasks(housekeeping);

  return async (job: QueueJob<HousekeepingJob>): Promise<Result<unknown, AnyFailure>> => {
    const { data } = job;
    logger?.info({ task: data.task, jobId: job.id }, 'executing housekeeping task');

    switch (data.task) {
      case 'reconcile-uploads':
        return await runReconcileUploads({
          repositories,
          multipart,
          probeQueue,
          metrics,
          rawBucket,
          maxInflightPerUser,
          ...tasks.uploads,
          logger,
        });

      case 'reconcile-processing':
        return await runReconcileProcessing({
          repositories,
          getQueue,
          workerId,
          ...tasks.processing,
          logger,
        });

      case 'purge-deleted':
        return await runPurgeDeleted({
          repositories,
          storage,
          rawBucket,
          publicBucket,
          ...tasks.purge,
          logger,
        });

      case 'expire-raw':
        return await runExpireRaw({
          repositories,
          storage,
          rawBucket,
          retentionDays,
          ...tasks.expire,
          logger,
        });

      case 'tmp-sweep':
        return ok(await runTmpSweep({ tmpDir, ...tasks.tmpSweep, logger }));

      case 'reconcile-reaction-counters':
        return await runReconcileReactionCounters({
          repositories,
          reactionCache,
          ...tasks.reactions,
          logger,
        });

      case 'flush-video-views':
        return await runFlushVideoViews({
          repositories,
          viewBuffer,
          metrics,
          now,
          batchRetentionMs: options.views.batchRetentionMs,
          logger,
        });

      default:
        return assertNever(data.task, 'createHousekeepingProcessor');
    }
  };
}
