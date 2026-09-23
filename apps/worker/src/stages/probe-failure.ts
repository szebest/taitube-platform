import type { JobQueue, QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { NotifyJob, type ProbeJob, defaultJobOptions, ids, stagePolicies } from '@vp/job-contracts';
import { type Result, isErr, ok, unwrapOr } from '@vp/result';

export interface ProbeFailureContext {
  repositories: Repositories;
  job: QueueJob<ProbeJob>;
  lockToken: string;
  getQueue?: (name: string) => JobQueue;
}

/**
 * Marks the step and the video failed and tells the owner. It reports back rather than raising, so
 * the stage keeps the single decision about how a probe ends.
 *
 * The notify enqueue is best-effort on purpose: the owner missing a failure e-mail is not a reason
 * to retry a probe that has already been recorded as permanently failed.
 */
export async function recordProbeFailure(
  ctx: ProbeFailureContext,
  errorCode: string,
  errorMessage: string
): Promise<Result<void, DatabaseUnavailable>> {
  const { repositories, job, lockToken, getQueue } = ctx;
  const { videoId } = job.data;

  await repositories.steps.fail({
    videoId,
    step: 'probe',
    rendition: '-',
    lockToken,
    errorCode,
    errorMessage,
  });

  const transitioned = await repositories.videos.transition({
    videoId,
    from: 'PROBING',
    to: 'FAILED',
    eventType: 'video.failed',
    eventPayload: { errorCode, errorMessage },
    patch: { errorCode, errorMessage },
  });
  if (isErr(transitioned)) return transitioned;

  if (!transitioned.value || !getQueue) return ok();

  const video = unwrapOr(await repositories.videos.findById(videoId), null);
  if (!video) return ok();

  await getQueue('notify')
    .add(
      'notify',
      NotifyJob.parse({
        videoId,
        userId: video.ownerId,
        event: 'video.failed',
        eventSeq: 1,
        payload: { status: 'FAILED', errorCode, errorMessage },
        traceparent: job.data.traceparent || '',
      }),
      {
        jobId: ids.notify(videoId, 'video.failed', 1),
        ...stagePolicies.notify,
        ...defaultJobOptions,
      }
    )
    .catch(() => {});

  return ok();
}
