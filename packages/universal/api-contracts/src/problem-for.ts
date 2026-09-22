import { type AnyFailure, failurePayload, isInputFailure } from '@vp/errors';
import { type Problem, problemDetails, problemStatus } from './problem.js';

export interface ProblemOverrides {
  readonly status?: number;
  readonly title?: string;
  readonly detail?: string;
  readonly errors?: unknown[];
}

/**
 * The one place a `Failure` becomes a `Problem`. Both edges call it - `sendResult` for a domain
 * failure and the Fastify backstop for anything that still escapes - so the two produce the same
 * body for the same failure.
 *
 * Wire safety is read off the failure's type, not off a list: an input failure names the field it
 * rejected and only repeats what the caller sent, so its payload is projected into `Problem.errors`.
 * A domain-rule or infra failure names no field, so its `operation`, its ids and its `cause` stay on
 * the server and only `code`, `title`, `status` and `detail` cross.
 */
export function problemFor(
  failure: AnyFailure,
  instance: string,
  overrides: ProblemOverrides = {}
): Problem {
  const errors = overrides.errors ?? (isInputFailure(failure) ? [failurePayload(failure)] : null);

  return problemDetails({
    code: failure.code,
    title: overrides.title ?? failure.message,
    status: overrides.status ?? problemStatus(failure.code),
    detail: overrides.detail ?? failure.message,
    instance,
    ...(errors ? { errors } : {}),
  });
}
