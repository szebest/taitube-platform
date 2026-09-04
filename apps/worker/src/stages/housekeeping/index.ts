import type {
  JobQueue,
  MultipartStorage,
  QueueJob,
  Repositories,
  StorageClient,
} from '@vp/core/ports';
import { HousekeepingJob, type QueueName } from '@vp/job-contracts';
import type { Logger } from '@vp/observability';
import { runExpireRaw } from './expire-raw.js';
import { runPurgeDeleted } from './purge-deleted.js';
import { runReconcileProcessing } from './reconcile-processing.js';
import { runReconcileUploads } from './reconcile-uploads.js';
import { runTmpSweep } from './tmp-sweep.js';

export * from './reconcile-uploads.js';
export * from './reconcile-processing.js';
export * from './purge-deleted.js';
export * from './expire-raw.js';
export * from './tmp-sweep.js';

export interface HousekeepingProcessorOptions {
  repositories: Repositories;
  storage: StorageClient;
  multipart?: MultipartStorage;
  getQueue?: (name: QueueName) => JobQueue;
  probeQueue?: JobQueue;
  workerId?: string;
  logger?: Logger;
}

export function createHousekeepingProcessor(
  options: HousekeepingProcessorOptions
): (job: QueueJob<unknown>) => Promise<unknown> {
  const { repositories, storage, multipart, getQueue, workerId, logger } = options;
  const probeQueue = options.probeQueue ?? (getQueue ? getQueue('probe') : undefined);

  return async (job: QueueJob<unknown>): Promise<unknown> => {
    const data = HousekeepingJob.parse(job.data);
    logger?.info({ task: data.task, jobId: job.id }, 'Executing housekeeping task');

    switch (data.task) {
      case 'reconcile-uploads':
        return await runReconcileUploads({
          repositories,
          multipart,
          probeQueue,
          logger,
        });

      case 'reconcile-processing':
        return await runReconcileProcessing({
          repositories,
          getQueue,
          workerId,
          logger,
        });

      case 'purge-deleted':
        return await runPurgeDeleted({
          repositories,
          storage,
          logger,
        });

      case 'expire-raw':
        return await runExpireRaw({
          repositories,
          storage,
          logger,
        });

      case 'tmp-sweep':
        return await runTmpSweep({
          logger,
        });

      default:
        throw new Error(`Unknown housekeeping task: ${(data as { task: string }).task}`);
    }
  };
}
