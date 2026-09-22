import { type AnyFailure, PermanentError, TransientError, retryClass } from '@vp/errors';
import { type Result, isErr } from '@vp/result';

const OFF_THE_JOB = new Set(['code', 'message', 'cause']);

function details(failure: AnyFailure): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(failure).filter(([key, value]) => !OFF_THE_JOB.has(key) && value !== undefined)
  );
}

/**
 * BullMQ's retry contract *is* the exception: a stage that returns normally is a completed job. So
 * this is where a failed `Result` becomes a throw, and it is the only such place in `apps/worker`.
 *
 * The class comes from `RETRY_CLASS` (ADR-18), so the decision is made once per code in the
 * vocabulary and the throw site has no judgement left to make - no reading a message, no guessing
 * from an error's shape.
 */
export function toQueueError(failure: AnyFailure): PermanentError | TransientError {
  const Queued = retryClass(failure.code) === 'permanent' ? PermanentError : TransientError;
  return new Queued(failure.code, failure.message, details(failure));
}

/**
 * Stages return a plain value until they are converted and a `Result` afterwards, so the runner has
 * to recognise one. Delete this once `throwing-domain-sources.ts` no longer lists a stage.
 */
export function failedResult(outcome: unknown): outcome is Result<never, AnyFailure> & {
  ok: false;
} {
  if (typeof outcome !== 'object' || outcome === null) return false;
  const candidate = outcome as { ok?: unknown; error?: { code?: unknown } };
  return candidate.ok === false && typeof candidate.error?.code === 'string' && isErr(
    outcome as Result<unknown, AnyFailure>
  );
}
