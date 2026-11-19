import { errorCodeOf } from '@kit/errors';
import { type Result, isErr, ok } from '@kit/result';
import type { QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { type DatabaseUnavailable, errorCodeRegistry } from '@vp/errors';
import { CaptionsJob } from '@vp/job-contracts';
import type { PipelineMetrics } from '@vp/pipeline-metrics';

/**
 * A run the failure handler parked marks its track `failed`, and the creator can retry it. Only the
 * track changes: the video's status and version are never touched by captions.
 */
export async function failCaptionsRun(
  repositories: Pick<Repositories, 'captions'>,
  metrics: PipelineMetrics,
  job: QueueJob<unknown>,
  error: Error
): Promise<Result<void, DatabaseUnavailable>> {
  const parsed = CaptionsJob.safeParse(job.data);
  if (!parsed.success) return ok();

  const failed = await repositories.captions.fail({
    id: parsed.data.captionId,
    expectedVersion: parsed.data.captionVersion,
    status: 'failed',
    reason: errorCodeOf(errorCodeRegistry, error),
  });
  if (isErr(failed)) return failed;
  if (failed.value.type === 'committed') metrics.captionsJobsTotal.inc({ outcome: 'failed' });
  return ok();
}
