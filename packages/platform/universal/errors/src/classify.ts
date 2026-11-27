import { type AnyFailure, failureDetails } from './failure';
import { PermanentError, PipelineError, TransientError } from './pipeline-error';
import { type ErrorCodeSet, isRegisteredCode, type RetryClass, retryClass } from './registry';

/**
 * `unknown` is a third answer on purpose: ADR-18 retries an unrecognised error a little and then
 * parks it, which needs a lower attempt cap than a failure we positively classified as transient.
 * Collapsing the two would silently give every unrecognised error the full retry budget.
 */
export type ErrorClassification = RetryClass | 'unknown';

/**
 * BullMQ's own permanent marker. `apps/server/worker` and the in-memory queue double may not import
 * `bullmq` - rule 4 confines it to `packages/server/adapters/**` - so this is the one foreign class
 * recognised by name rather than by `instanceof`. The BullMQ adapter, which may import it, uses a
 * real `instanceof` instead.
 */
const FOREIGN_UNRECOVERABLE = 'UnrecoverableError';

const fieldOf = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;

/**
 * The one place an error's retry class is decided. Our own classes answer for themselves; anything
 * else is decided by its code through the set's retry classes, never by reading a message or a
 * class name.
 */
export function classifyError<C extends string>(
  set: ErrorCodeSet<C>,
  error: unknown
): ErrorClassification {
  if (error instanceof PipelineError) return error.isRetryable ? 'transient' : 'permanent';
  if (fieldOf(error, 'name') === FOREIGN_UNRECOVERABLE) return 'permanent';

  const code = fieldOf(error, 'code');
  if (typeof code !== 'string') return 'unknown';
  return isRegisteredCode(set, code) ? set.retryClass[code] : 'unknown';
}

const UNKNOWN_ATTEMPT_CAP = 3;

/** How many of a policy's `allowed` attempts a failure gets before it is parked (ADR-18). */
export function attemptsFor<C extends string>(
  set: ErrorCodeSet<C>,
  error: unknown,
  allowed: number
): number {
  switch (classifyError(set, error)) {
    case 'permanent':
      return 1;
    case 'unknown':
      return Math.min(allowed, UNKNOWN_ATTEMPT_CAP);
    case 'transient':
      return allowed;
  }
}

/**
 * The code to persist for an error that reached a queue boundary: its own when it carries one from
 * the set, directly or as its `cause`, and the set's `internal` otherwise. Never a string of its own.
 */
export function errorCodeOf<C extends string>(set: ErrorCodeSet<C>, error: unknown): C {
  const code = fieldOf(error, 'code');
  if (isRegisteredCode(set, code)) return code;
  const causeCode = fieldOf(fieldOf(error, 'cause'), 'code');
  return isRegisteredCode(set, causeCode) ? causeCode : set.internal;
}

/**
 * The reverse direction, in the same file for the same reason: a boundary that still signals
 * failure by throwing - BullMQ's retry contract, a route handler that has not been converted -
 * turns a `Result` failure into an `Error` here, and the set's retry class picks the class. No call
 * site gets to hand-pick `PermanentError` and quietly disagree with the taxonomy.
 */
export function toPipelineError<C extends string>(
  set: ErrorCodeSet<C>,
  failure: AnyFailure
): PermanentError | TransientError {
  const Thrown = retryClass(set, failure.code) === 'permanent' ? PermanentError : TransientError;
  return new Thrown(failure.code, failure.message, failureDetails(failure));
}

/**
 * What a composition root throws for a start that failed: an `Error` as it came, a failure from the
 * set through `toPipelineError`, and anything else wrapped, so no cast decides which it was.
 */
export function asThrowable<C extends string>(set: ErrorCodeSet<C>, cause: unknown): Error {
  if (cause instanceof Error) return cause;
  const code = fieldOf(cause, 'code');
  if (typeof cause === 'object' && cause !== null && isRegisteredCode(set, code)) {
    const message = fieldOf(cause, 'message');
    return toPipelineError(set, {
      ...cause,
      code,
      message: typeof message === 'string' ? message : code,
    });
  }
  return new Error(String(cause));
}
