import { type Problem, problemFor } from '@vp/api-contracts';
import type { AnyFailure } from '@vp/errors';
import type { Result } from '@vp/result';
import type { FastifyReply, FastifyRequest } from 'fastify';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json; charset=utf-8';

/**
 * Typed from the service's own error union, so an override for a code the service cannot return is
 * a compile error and a handler receives the narrowed variant with its payload.
 */
export type FailureOverrides<E extends AnyFailure> = Partial<{
  [C in E['code']]: (failure: Extract<E, { readonly code: C }>) => Problem;
}>;

export interface SendResultOptions<E extends AnyFailure> {
  /** Success status. Defaults to 200; a create passes 201 and a delete 204. */
  readonly status?: number;
  /** One code, this route only, differing from the `PROBLEM_STATUS` default. */
  readonly on?: FailureOverrides<E>;
  /** A total presenter for the whole union, when the route owns a real mapping. */
  readonly present?: (failure: E) => Problem;
}

/**
 * The only place in `apps/api` where a `Result` is unwrapped (SDD ADR-24, §6.4).
 *
 * The default is total: `problemFor` reads `PROBLEM_STATUS`, which is declared over the whole
 * `ErrorCode` union, so a route that wants the standard response passes nothing and a route that
 * wants to differ says so at the point that cares. That is what lets the public video route render
 * `FORBIDDEN` as a generic 404 while an admin route renders the same failure, from the same service
 * call, as a detailed 403.
 */
export function sendResult<T, E extends AnyFailure>(
  reply: FastifyReply,
  request: FastifyRequest,
  result: Result<T, E>,
  options: SendResultOptions<E> = {}
): FastifyReply {
  const status = options.status ?? 200;

  if (result.ok) {
    return status === 204 ? reply.status(204).send() : reply.status(status).send(result.value);
  }

  const failure = result.error;
  const override = options.on?.[failure.code as E['code']] as
    | ((failure: E) => Problem)
    | undefined;
  const problem =
    override?.(failure) ?? options.present?.(failure) ?? problemFor(failure, request.url);

  reply.header('content-type', PROBLEM_CONTENT_TYPE);
  return reply.status(problem.status).send(problem);
}
