import type { QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { classifyError, type DatabaseUnavailable, errorCodeOf } from '@vp/errors';
import { CaptionsJob } from '@vp/job-contracts';
import type { PipelineMetrics } from '@vp/observability';
import { isErr, ok, type Result } from '@vp/result';

/**
 * A run that spent its last attempt marks its track `failed`, and the creator can retry it. Only the
 * track changes: the video's status and version are never touched by captions.
 */
export async function failCaptionsRun(
  repositories: Pick<Repositories, 'captions'>,
  metrics: PipelineMetrics,
  job: QueueJob<unknown>,
  error: Error
): Promise<Result<void, DatabaseUnavailable>> {
  const parsed = CaptionsJob.safeParse(job.data);
  const exhausted =
    classifyError(error) === 'permanent' || (job.attemptsMade ?? 1) >= (job.opts?.attempts ?? 1);
  if (!(parsed.success && exhausted)) return ok();

  const failed = await repositories.captions.fail({
    id: parsed.data.captionId,
    expectedVersion: parsed.data.captionVersion,
    status: 'failed',
    reason: errorCodeOf(error),
  });
  if (isErr(failed)) return failed;
  if (failed.value.type === 'committed') metrics.captionsJobsTotal.inc({ outcome: 'failed' });
  return ok();
}
