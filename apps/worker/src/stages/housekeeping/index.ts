import type {
  JobQueue,
  MultipartStorage,
  QueueJob,
  Repositories,
  StorageClient,
} from '@vp/core/ports';
import { HousekeepingJob, type QueueName } from '@vp/job-contracts';
import type { Logger } from '@vp/observability';
import { runExpireRaw } from './expire-raw';
import { runPurgeDeleted } from './purge-deleted';
import { runReconcileProcessing } from './reconcile-processing';
import { runReconcileUploads } from './reconcile-uploads';
import { runTmpSweep } from './tmp-sweep';

export * from './reconcile-uploads';
export * from './reconcile-processing';
export * from './purge-deleted';
export * from './expire-raw';
export * from './tmp-sweep';
export * from './outbox-relay';

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
