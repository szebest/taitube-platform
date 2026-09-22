import { type AnyFailure, toPipelineError } from '@vp/errors';
import { type Result, isErr } from '@vp/result';

/**
 * BullMQ's retry contract *is* the exception: a stage that returns normally is a completed job, so
 * a failure it cannot act on has to become a throw. `@vp/errors` owns which class that is, so the
 * worker and the API's remaining throw sites cannot disagree about the same code.
 */
export function unwrapOrThrow<T>(result: Result<T, AnyFailure>): T {
  if (isErr(result)) throw toPipelineError(result.error);
  return result.value;
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
  return (
    candidate.ok === false &&
    typeof candidate.error?.code === 'string' &&
    isErr(outcome as Result<unknown, AnyFailure>)
  );
}
