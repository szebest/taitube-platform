import type { QueueJob } from '@vp/core/ports';
import type { CaptionRecord } from '@vp/core/repositories';
import type { DatabaseUnavailable, ErrorCode } from '@vp/errors';
import type { CaptionsJob } from '@vp/job-contracts';
import { type Result, err, isErr, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { createScratchDir, removeScratchDir } from '../scratch-dir';
import { type StepLease, stepLease } from '../step-lease';
import type { CaptionsStageDeps } from './captions-deps';

const STEP = 'captions';

export interface CaptionsScope {
  track: CaptionRecord;
  scratchDir: string;
  signal: AbortSignal;
}

export type Skipped = { type: 'skipped' };
const SKIPPED: Skipped = { type: 'skipped' };

/** `w<n>` for a window, so each window has a step row of its own beside the run's. */
export function stepRenditionOf(job: CaptionsJob): string {
  const run = `${job.modelVersion}--v${job.captionVersion}`;
  return job.plan.type === 'window' ? `${run}--w${job.plan.index}` : run;
}

/**
 * A run works only on the track version it was asked for: a regenerate, a delete or an upload since
 * then makes it stale, and it steps aside without writing.
 */
async function currentTrack(
  deps: CaptionsStageDeps,
  job: CaptionsJob
): Promise<Result<CaptionRecord | undefined, DatabaseUnavailable>> {
  const found = await deps.repositories.captions.findById(job.captionId);
  if (isErr(found)) return found;
  const track = found.value;
  const current = track?.status === 'pending' && track.version === job.captionVersion;
  return ok(current ? track : undefined);
}

function renewWhileRunning(lease: StepLease, everyMs: number): () => void {
  const timer = setInterval(() => lease.renew(true), everyMs);
  return () => clearInterval(timer);
}

/**
 * Claims the run's step row with a fresh lock token, keeps it alive while whisper runs, and commits
 * the outcome fenced: a stale worker whose step was reclaimed writes nothing.
 */
export async function inClaimedStep<T, F extends { code: ErrorCode; message: string }>(
  deps: CaptionsStageDeps,
  job: QueueJob<CaptionsJob>,
  work: (scope: CaptionsScope) => Promise<Result<T, F>>
): Promise<Result<T | Skipped, F | DatabaseUnavailable>> {
  const { videoId } = job.data;
  const rendition = stepRenditionOf(job.data);
  const log = deps.logger.child({ videoId, jobId: job.id, stage: STEP, rendition });

  const track = await currentTrack(deps, job.data);
  if (isErr(track)) return track;
  if (!track.value) {
    log.info({ captionId: job.data.captionId }, 'captions run is stale; skipping');
    return ok(SKIPPED);
  }

  const lockToken = uuidv7();
  const claim = await deps.repositories.steps.claim({
    id: uuidv7(),
    videoId,
    step: STEP,
    rendition,
    jobId: job.id,
    attempt: (job.attemptsMade ?? 0) + 1,
    workerId: deps.workerId,
    lockToken,
  });
  if (isErr(claim)) return claim;
  if (claim.value.fenced) return ok(SKIPPED);

  const scratchDir = await createScratchDir(deps.tmpDir, `vp-captions-${videoId}-`);
  const lease = stepLease(deps.repositories.steps, lockToken);
  const stopRenewing = renewWhileRunning(lease, deps.captions.process.leaseRenewMs);
  try {
    const outcome = await work({ track: track.value, scratchDir, signal: lease.signal });
    await lease.settled();
    if (lease.lost) {
      log.warn({ lease: lease.lost.type }, 'captions step lease lost');
      return lease.lost.type === 'fenced' ? ok(SKIPPED) : err(lease.lost.failure);
    }

    if (isErr(outcome)) {
      const failed = await deps.repositories.steps.fail({
        videoId,
        step: STEP,
        rendition,
        lockToken,
        errorCode: outcome.error.code,
        errorMessage: outcome.error.message,
      });
      return isErr(failed) ? failed : outcome;
    }
    const completed = await deps.repositories.steps.complete({
      videoId,
      step: STEP,
      rendition,
      lockToken,
    });
    if (isErr(completed)) return completed;
    return completed.value.fenced ? ok(SKIPPED) : outcome;
  } finally {
    stopRenewing();
    await removeScratchDir(scratchDir);
  }
}

/** A source with no audio is not a failure: its generated track is disabled and the job succeeds. */
export async function disableSilentTrack(
  deps: CaptionsStageDeps,
  job: CaptionsJob
): Promise<Result<Skipped, DatabaseUnavailable>> {
  const disabled = await deps.repositories.captions.fail({
    id: job.captionId,
    expectedVersion: job.captionVersion,
    status: 'disabled',
    reason: 'NO_AUDIO',
  });
  if (isErr(disabled)) return disabled;
  deps.metrics.captionsJobsTotal.inc({ outcome: 'disabled' });
  return ok(SKIPPED);
}
