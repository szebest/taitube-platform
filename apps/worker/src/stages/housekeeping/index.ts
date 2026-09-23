import type {
  JobQueue,
  MultipartStorage,
  QueueJob,
  ReactionCachePort,
  StorageClient,
} from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { AppConfig } from '@vp/env-schema';
import type { AnyFailure } from '@vp/errors';
import { HousekeepingJob, type QueueName } from '@vp/job-contracts';
import type { Logger } from '@vp/observability';
import { type Result, assertNever, ok } from '@vp/result';
import { runExpireRaw } from './expire-raw';
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

export interface HousekeepingSettings {
  rawBucket: string;
  publicBucket: string;
  retentionDays: number;
  maxInflightPerUser: number;
  tmpDir: string;
  housekeeping: AppConfig['housekeeping'];
}

export interface HousekeepingProcessorOptions extends HousekeepingSettings {
  repositories: Repositories;
  storage: StorageClient;
  multipart: MultipartStorage;
  reactionCache: ReactionCachePort;
  getQueue: (name: QueueName) => JobQueue;
  workerId: string;
  logger?: Logger;
}

export function housekeepingTasks(housekeeping: AppConfig['housekeeping']) {
  return {
    uploads: {
      uploadingThresholdMs: housekeeping.stuckUploadingAfterMs,
      uploadedThresholdMs: housekeeping.stuckUploadedAfterMs,
    },
    processing: { thresholdMs: housekeeping.stuckProcessingAfterMs },
    purge: { thresholdMs: housekeeping.purgeDeletedAfterMs },
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
): (job: QueueJob<unknown>) => Promise<Result<unknown, AnyFailure>> {
  const { repositories, storage, multipart, reactionCache, getQueue, workerId, logger } = options;
  const { rawBucket, publicBucket, retentionDays, maxInflightPerUser, tmpDir, housekeeping } =
    options;
  const probeQueue = getQueue('probe');
  const tasks = housekeepingTasks(housekeeping);

  return async (job: QueueJob<unknown>): Promise<Result<unknown, AnyFailure>> => {
    const data = HousekeepingJob.parse(job.data);
    logger?.info({ task: data.task, jobId: job.id }, 'Executing housekeeping task');

    switch (data.task) {
      case 'reconcile-uploads':
        return await runReconcileUploads({
          repositories,
          multipart,
          probeQueue,
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

      default:
        return assertNever(data.task, 'createHousekeepingProcessor');
    }
  };
}
