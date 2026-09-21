import { type Problem, problemDetails, problemStatus } from '@vp/api-contracts';
import { ErrorCodes, PipelineError } from '@vp/errors';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

interface ErrorWithCode {
  code: string;
}

interface ErrorWithValidation {
  validation?: unknown[];
  issues?: unknown[];
}

interface ErrorWithStatusCode {
  statusCode?: number;
}

export const PROBLEM_CONTENT_TYPE = 'application/problem+json; charset=utf-8';

export function rateLimitProblem(instance: string, detail = 'Rate limit exceeded'): Problem {
  return problemDetails({
    code: ErrorCodes.RATE_LIMITED,
    title: 'Too Many Requests',
    status: 429,
    detail,
    instance,
  });
}

/**
 * Renders a thrown domain error. Scopes whose own plugin installs an error handler —
 * Bull Board does — call this so they answer with the same body as every other route.
 */
export function domainProblem(code: string, message: string, instance: string): Problem {
  return problemDetails({
    code,
    title: message || 'Domain Error',
    status: problemStatus(code),
    detail: message,
    instance,
  });
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
      reply.header('content-type', PROBLEM_CONTENT_TYPE);

      const errorStatusCode = (error as ErrorWithStatusCode).statusCode;
      const errorCode = (error as ErrorWithCode).code;

      if (
        errorStatusCode === 429 ||
        errorCode === ErrorCodes.RATE_LIMITED ||
        errorCode === 'FST_ERR_RATE_LIMIT'
      ) {
        return reply
          .status(429)
          .send(rateLimitProblem(request.url, error.message || 'Rate limit exceeded'));
      }

      if (
        error instanceof PipelineError ||
        (typeof errorCode === 'string' && Object.hasOwn(ErrorCodes, errorCode))
      ) {
        const problem = domainProblem(errorCode, error.message, request.url);
        return reply.status(problem.status).send(problem);
      }

      const validationError = error as ErrorWithValidation;
      const issues = validationError.validation ?? validationError.issues;
      if (issues) {
        return reply.status(400).send(
          problemDetails({
            code: ErrorCodes.VALIDATION_FAILED,
            title: 'Validation Failed',
            status: 400,
            detail: error.message,
            instance: request.url,
            errors: issues,
          })
        );
      }

      request.log.error(
        { err: error, requestId: request.id || 'req-unknown' },
        'Unhandled exception'
      );
      return reply.status(500).send(
        problemDetails({
          code: ErrorCodes.INTERNAL,
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected internal error occurred',
          instance: request.url,
        })
      );
    }
  );
}
