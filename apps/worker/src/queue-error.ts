import type { AnyFailure } from '@vp/errors';
import { type Result, isErr } from '@vp/result';

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
