import type { JobQueue, QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import {
  DlqJob,
  NotifyJob,
  type QueueName,
  defaultJobOptions,
  ids,
  stagePolicies,
} from '@vp/job-contracts';
import type { Logger, PipelineMetrics } from '@vp/observability';
import { uuidv7 } from 'uuidv7';

export interface FailureHandlerDeps {
  stage: string;
  queueName: string;
  repositories: Repositories;
  getQueue?: (name: string) => JobQueue;
  logger: Logger;
  metrics?: PipelineMetrics;
  workerId?: string;
}

export function createFailureHandler(deps: FailureHandlerDeps) {
  const {
    stage,
    queueName,
    repositories,
    getQueue,
    logger,
    metrics,
    workerId = `worker-${process.pid}`,
  } = deps;

  return async function onFailed(job: QueueJob<unknown>, err: Error): Promise<void> {
    const jobId = job.id || '';
    const payload = (job.data || {}) as Record<string, unknown>;
    const videoId = (payload.videoId as string) || null;
    const attemptsMade = job.attemptsMade ?? 1;

    // 1. Resolve error code
    interface ErrorWithDetails {
      code?: string;
      errorCode?: string;
      cause?: unknown;
    }
    const errObj = err as ErrorWithDetails;
    const causeObj =
      errObj.cause && typeof errObj.cause === 'object'
        ? (errObj.cause as ErrorWithDetails)
        : undefined;
    let errorCode: string =
      (typeof errObj.code === 'string' && errObj.code) ||
      (typeof errObj.errorCode === 'string' && errObj.errorCode) ||
      (typeof causeObj?.code === 'string' && causeObj.code) ||
      '';

    if (!errorCode) {
      if (err.name === 'UnrecoverableError') {
        errorCode = 'UNRECOVERABLE_ERROR';
      } else {
        errorCode = 'INTERNAL';
      }
    }

    const errorMessage = err.message || 'Job failed';
    const stack = err.stack ?? null;

    // 2. Alerting / metric hook (AC 6)
    if (metrics?.dlqEntriesTotal) {
      metrics.dlqEntriesTotal.inc({ queue: queueName, error_code: errorCode });
    }
    logger.warn(
      { queue: queueName, error_code: errorCode, jobId, attemptsMade },
      `dlq_entries_total{queue="${queueName}", error_code="${errorCode}"} incremented`
    );

    // 3. Insert dlq_entries (unique per queue/job/attempt) (AC 3)
    const dlqEntryId = uuidv7();
    try {
      await repositories.dlq.create({
        id: dlqEntryId,
        queue: queueName,
        jobId,
        videoId,
        payload: job.data,
        errorCode,
        errorMessage,
        stack,
        attemptsMade,
        workerId,
        status: 'PARKED',
      });
    } catch (createErr: unknown) {
      logger.error(
        { err: (createErr as Error).message, jobId, queueName },
        'Failed to insert dlq_entries row'
      );
    }

    // 4. Add DlqJob copy to dlq queue (no worker consuming dlq) (AC 3)
    if (getQueue) {
      try {
        const dlqQueue = getQueue('dlq');
        const dlqJobId = ids.dlq(queueName, jobId, attemptsMade);
        const dlqPayload = DlqJob.parse({
          originQueue: queueName as QueueName,
          originJobId: jobId,
          payload: job.data,
          error: {
            code: errorCode,
            message: errorMessage,
            stack: stack ?? undefined,
            unrecoverable:
              (err as { isRetryable?: boolean }).isRetryable === false ||
              err.name === 'UnrecoverableError',
          },
          attemptsMade,
          workerId,
          failedAt: new Date().toISOString(),
        });

        await dlqQueue.add('dlq', dlqPayload, {
          jobId: dlqJobId,
          removeOnComplete: defaultJobOptions.removeOnComplete,
          removeOnFail: defaultJobOptions.removeOnFail,
        });
        logger.info({ dlqJobId }, 'Enqueued DLQ copy job');
      } catch (dlqErr: unknown) {
        logger.error(
          { err: (dlqErr as Error).message, jobId },
          'Failed to add copy of job to dlq queue'
        );
      }
    }

    // 5. Mark processing_steps DEAD and renditions FAILED (AC 3)
    if (videoId) {
      let stepName = stage;
      let renditionName = '-';
      if (stage.startsWith('transcode-')) {
        stepName = 'transcode';
        const renditionObj = payload.rendition as { name?: string } | undefined;
        renditionName = renditionObj?.name || stage.replace('transcode-', '');
      }

      await repositories.steps
        .markDead({
          videoId,
          step: stepName,
          rendition: renditionName,
          errorCode,
          errorMessage,
        })
        .catch(() => {});

      if (stage.startsWith('transcode-')) {
        await repositories.renditions
          .update(videoId, renditionName, { status: 'FAILED' })
          .catch(() => {});
      }
    }

    // 6. With failParentOnFailure, parent fails and video becomes FAILED with first child's error code (AC 3)
    if (stage === 'package' && videoId) {
      // Find first failed child step to adopt its error code
      let videoErrorCode = errorCode;
      try {
        const steps = await repositories.steps.findByVideoId(videoId);
        const failedChild = steps.find(
          (s) =>
            (s.status === 'DEAD' || s.status === 'FAILED') && s.errorCode && s.step !== 'package'
        );
        if (failedChild?.errorCode) {
          videoErrorCode = failedChild.errorCode;
        }
      } catch {}

      const video = await repositories.videos.findById(videoId).catch(() => null);
      const notifyJobId = ids.notify(videoId, 'video.failed', 1);
      const notifyJobData = video
        ? NotifyJob.parse({
            videoId,
            userId: video.ownerId,
            event: 'video.failed',
            eventSeq: 1,
            payload: { status: 'FAILED', errorCode: videoErrorCode, errorMessage },
            traceparent: (payload.traceparent as string) || '',
          })
        : undefined;
      const notifyJobOpts = {
        jobId: notifyJobId,
        ...stagePolicies.notify,
        ...defaultJobOptions,
      };

      const transitioned = await repositories.videos
        .transition({
          videoId,
          from: ['PROCESSING', 'PROBING'],
          to: 'FAILED',
          eventType: 'video.failed',
          eventPayload: { errorCode: videoErrorCode, errorMessage },
          patch: { errorCode: videoErrorCode, errorMessage },
          outbox: notifyJobData
            ? {
                kind: 'notify',
                payload: {
                  type: 'queue',
                  queueName: 'notify',
                  job: {
                    name: 'notify',
                    data: notifyJobData,
                    opts: notifyJobOpts,
                  },
                },
              }
            : undefined,
        })
        .catch(() => false);

      if (transitioned) {
        logger.error(
          { videoId, videoErrorCode, errorMessage },
          'Package failure transitioned video to FAILED'
        );

        // Publish video.failed notification
        if (notifyJobData && getQueue) {
          const notifyQueue = getQueue('notify');
          await notifyQueue.add('notify', notifyJobData, notifyJobOpts).catch(() => {});
        }
      }
    }
  };
}
