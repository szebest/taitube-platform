import type { JobQueue, QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { classifyError, errorCodeOf, isErrorCode } from '@vp/errors';
import {
  DlqJob,
  type NotifyJob,
  type QueueName,
  defaultJobOptions,
  ids,
  stagePolicies,
} from '@vp/job-contracts';
import type { PipelineMetrics } from '@vp/observability';
import type { Logger } from '@vp/logger';
import { isErr, unwrapOr } from '@vp/result';
import { uuidv7 } from 'uuidv7';

export interface FailureHandlerDeps {
  stage: string;
  queueName: string;
  repositories: Repositories;
  getQueue?: (name: string) => JobQueue;
  logger: Logger;
  metrics: PipelineMetrics;
  workerId: string;
}

export function createFailureHandler(deps: FailureHandlerDeps) {
  const { stage, queueName, repositories, getQueue, logger, metrics, workerId } = deps;

  return async function onFailed(job: QueueJob<unknown>, err: Error): Promise<void> {
    const jobId = job.id || '';
    const payload = (job.data || {}) as Record<string, unknown>;
    const videoId = (payload.videoId as string) || null;
    const attemptsMade = job.attemptsMade ?? 1;

    const errorCode = errorCodeOf(err);
    const errorMessage = err.message || 'Job failed';
    const stack = err.stack ?? null;

    metrics.dlqEntriesTotal.inc({ queue: queueName, error_code: errorCode });
    logger.warn(
      { queue: queueName, error_code: errorCode, jobId, attemptsMade },
      'job routed to the dead letter queue'
    );

    const created = await repositories.dlq.create({
      id: uuidv7(),
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
    if (isErr(created)) {
      logger.error(
        { err: created.error, jobId, queueName },
        'failed to insert dlq_entries row'
      );
    }

    if (getQueue) {
      const dlqJobId = ids.dlq(queueName, jobId, attemptsMade);
      // safeParse rather than parse: an origin queue outside QUEUES is a caller bug worth a log,
      // not a throw out of the handler that is already recording someone else's failure.
      const dlqPayload = DlqJob.safeParse({
        originQueue: queueName as QueueName,
        originJobId: jobId,
        payload: job.data,
        error: {
          code: errorCode,
          message: errorMessage,
          stack: stack ?? undefined,
          unrecoverable: classifyError(err) === 'permanent',
        },
        attemptsMade,
        workerId,
        failedAt: new Date().toISOString(),
      });

      if (!dlqPayload.success) {
        logger.error(
          { err: dlqPayload.error, jobId, queueName },
          'failed to build copy of job for dlq queue'
        );
      } else {
        const added = await getQueue('dlq').add('dlq', dlqPayload.data, {
          jobId: dlqJobId,
          removeOnComplete: defaultJobOptions.removeOnComplete,
          removeOnFail: defaultJobOptions.removeOnFail,
        });
        if (isErr(added)) {
          logger.error(
            { err: added.error, jobId },
            'failed to add copy of job to dlq queue'
          );
        } else {
          logger.info({ dlqJobId }, 'enqueued DLQ copy job');
        }
      }
    }

    if (videoId) {
      let stepName = stage;
      let renditionName = '-';
      if (stage.startsWith('transcode-')) {
        stepName = 'transcode';
        const renditionObj = payload.rendition as { name?: string } | undefined;
        renditionName = renditionObj?.name || stage.replace('transcode-', '');
      }

      const marked = await repositories.steps.markDead({
        videoId,
        step: stepName,
        rendition: renditionName,
        errorCode,
        errorMessage,
      });
      if (isErr(marked)) {
        logger.error(
          { err: marked.error, videoId, step: stepName },
          'failed to mark processing step DEAD'
        );
      }

      if (stage.startsWith('transcode-')) {
        const failed = await repositories.renditions.update(videoId, renditionName, {
          status: 'FAILED',
        });
        if (isErr(failed)) {
          logger.error(
            { err: failed.error, videoId, rendition: renditionName },
            'failed to mark rendition FAILED'
          );
        }
      }
    }

    if (stage === 'package' && videoId) {
      const steps = unwrapOr(await repositories.steps.findByVideoId(videoId), []);
      const failedChild = steps.find(
        (s) => (s.status === 'DEAD' || s.status === 'FAILED') && s.errorCode && s.step !== 'package'
      );
      const childCode = failedChild?.errorCode;
      const videoErrorCode = isErrorCode(childCode) ? childCode : errorCode;

      const video = unwrapOr(await repositories.videos.findById(videoId), null);
      const notifyJobId = ids.notify(videoId, 'video.failed', 1);
      const notifyJobData: NotifyJob | undefined = video
        ? {
            videoId,
            userId: video.ownerId,
            event: 'video.failed',
            eventSeq: 1,
            payload: { status: 'FAILED', errorCode: videoErrorCode, errorMessage },
            traceparent: (payload.traceparent as string) || '',
          }
        : undefined;
      const notifyJobOpts = {
        jobId: notifyJobId,
        ...stagePolicies.notify,
        ...defaultJobOptions,
      };

      const transitioned = unwrapOr(
        await repositories.videos.transition({
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
        }),
        false
      );

      if (transitioned) {
        logger.error(
          { videoId, videoErrorCode, errorMessage },
          'package failure transitioned video to FAILED'
        );

        if (notifyJobData && getQueue) {
          const notified = await getQueue('notify').add('notify', notifyJobData, notifyJobOpts);
          if (isErr(notified)) {
            logger.error(
              { err: notified.error, videoId },
              'failed to publish video.failed to the notify queue'
            );
          }
        }
      }
    }
  };
}
