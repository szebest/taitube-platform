import { type ErrorCode, ErrorCodes } from './error-codes';
import { type AnyFailure, failureDetails } from './failure';
import { PermanentError, PipelineError, TransientError } from './pipeline-error';
import { RETRY_CLASS, type RetryClass, retryClass } from './retry-class';

/**
 * `unknown` is a third answer on purpose: ADR-18 retries an unrecognised error a little and then
 * parks it, which needs a lower attempt cap than a failure we positively classified as transient.
 * Collapsing the two would silently give every unrecognised error the full retry budget.
 */
export type ErrorClassification = RetryClass | 'unknown';

/**
 * BullMQ's own permanent marker. `apps/worker` and the in-memory queue double may not import
 * `bullmq` - rule 4 confines it to `packages/server/adapters/**` - so this is the one foreign class
 * recognised by name rather than by `instanceof`. The BullMQ adapter, which may import it, uses a
 * real `instanceof` instead.
 */
const FOREIGN_UNRECOVERABLE = 'UnrecoverableError';

/**
 * The one place an error's retry class is decided. Our own classes answer for themselves; anything
 * else is decided by its code through `RETRY_CLASS`, never by reading a message or a class name.
 */
export function classifyError(error: unknown): ErrorClassification {
  if (error instanceof PipelineError) return error.isRetryable ? 'transient' : 'permanent';

  if (typeof error === 'object' && error !== null) {
    const shaped = error as { code?: unknown; name?: unknown };
    if (shaped.name === FOREIGN_UNRECOVERABLE) return 'permanent';
    if (typeof shaped.code === 'string') {
      return RETRY_CLASS[shaped.code as ErrorCode] ?? 'unknown';
    }
  }

  return 'unknown';
}

export function isErrorCode(code: unknown): code is ErrorCode {
  return typeof code === 'string' && Object.hasOwn(RETRY_CLASS, code);
}

/**
 * The code to persist for an error that reached a queue boundary: its own when it carries one from
 * the vocabulary, directly or as its `cause`, and `INTERNAL` otherwise. Never a string of its own.
 */
export function errorCodeOf(error: unknown): ErrorCode {
  const shaped = (error ?? {}) as { code?: unknown; cause?: { code?: unknown } };
  if (isErrorCode(shaped.code)) return shaped.code;
  if (isErrorCode(shaped.cause?.code)) return shaped.cause.code;
  return ErrorCodes.INTERNAL;
}

export function isPermanentError(error: unknown): boolean {
  return classifyError(error) === 'permanent';
}

export function isTransientError(error: unknown): boolean {
  return classifyError(error) === 'transient';
}

/**
 * The reverse direction, in the same file for the same reason: a boundary that still signals
 * failure by throwing - BullMQ's retry contract, a route handler that has not been converted -
 * turns a `Result` failure into an `Error` here, and `RETRY_CLASS` picks the class. No call site
 * gets to hand-pick `PermanentError` and quietly disagree with the taxonomy.
 */
export function toPipelineError(failure: AnyFailure): PermanentError | TransientError {
  const Thrown = retryClass(failure.code) === 'permanent' ? PermanentError : TransientError;
  return new Thrown(failure.code, failure.message, failureDetails(failure));
}

/**
 * What a composition root throws for a start that failed: an `Error` as it came, a failure from the
 * vocabulary through `toPipelineError`, and anything else wrapped, so no cast decides which it was.
 */
export function asThrowable(cause: unknown): Error {
  if (cause instanceof Error) return cause;
  const failure = cause as Partial<AnyFailure> | null;
  if (isErrorCode(failure?.code)) {
    return toPipelineError({
      ...failure,
      code: failure.code,
      message: failure.message ?? failure.code,
    });
  }
  return new Error(String(cause));
}
