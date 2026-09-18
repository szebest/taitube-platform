import { type ErrorCode, ErrorCodes, PermanentError, PipelineError } from '@vp/errors';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: ErrorCode | string;
  instance: string;
  errors?: unknown[];
}

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

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
      reply.header('content-type', 'application/problem+json; charset=utf-8');

      // 1. Rate-limit error (HTTP 429)
      const errorStatusCode = (error as ErrorWithStatusCode).statusCode;
      const errorCode = (error as ErrorWithCode).code;

      if (
        errorStatusCode === 429 ||
        errorCode === ErrorCodes.RATE_LIMITED ||
        errorCode === 'FST_ERR_RATE_LIMIT'
      ) {
        const problem: ProblemDetails = {
          type: `https://errors.video-pipeline.local/${ErrorCodes.RATE_LIMITED}`,
          title: 'Too Many Requests',
          status: 429,
          detail: error.message || 'Rate limit exceeded',
          code: ErrorCodes.RATE_LIMITED,
          instance: request.url,
        };
        return reply.status(429).send(problem);
      }

      // 2. Domain / Pipeline Errors (@vp/errors)
      if (
        error instanceof PipelineError ||
        error instanceof PermanentError ||
        (typeof errorCode === 'string' &&
          Object.values(ErrorCodes).includes(errorCode as ErrorCode))
      ) {
        const errCode = errorCode;
        let statusCode = 422;
        switch (errCode) {
          case ErrorCodes.VIDEO_NOT_FOUND:
          case ErrorCodes.DLQ_ENTRY_NOT_FOUND:
          case ErrorCodes.CATEGORY_NOT_FOUND:
          case ErrorCodes.CHANNEL_NOT_FOUND:
            statusCode = 404;
            break;
          case ErrorCodes.UNAUTHORIZED:
            statusCode = 401;
            break;
          case ErrorCodes.FORBIDDEN:
            statusCode = 403;
            break;
          case ErrorCodes.VERSION_CONFLICT:
          case ErrorCodes.CATEGORY_SLUG_CONFLICT:
          case ErrorCodes.CATEGORY_IN_USE:
          case ErrorCodes.HANDLE_ALREADY_TAKEN:
            statusCode = 409;
            break;
          case ErrorCodes.UPLOAD_NOT_OPEN:
            statusCode = 410;
            break;
          case ErrorCodes.INVALID_HANDLE_FORMAT:
            statusCode = 400;
            break;
          case ErrorCodes.RATE_LIMITED:
            statusCode = 429;
            break;
          case ErrorCodes.STORAGE_UNAVAILABLE:
            statusCode = 503;
            break;
          case ErrorCodes.INTERNAL:
            statusCode = 500;
            break;
          case ErrorCodes.VALIDATION_FAILED:
            statusCode = 422;
            break;
          default:
            statusCode = 422;
            break;
        }

        const problem: ProblemDetails = {
          type: `https://errors.video-pipeline.local/${errCode}`,
          title: error.message || 'Domain Error',
          status: statusCode,
          detail: error.message,
          code: errCode,
          instance: request.url,
        };

        return reply.status(statusCode).send(problem);
      }

      // 3. Fastify / Zod validation error
      const validationError = error as ErrorWithValidation;
      if (validationError.validation || validationError.issues) {
        const problem: ProblemDetails = {
          type: `https://errors.video-pipeline.local/${ErrorCodes.VALIDATION_FAILED}`,
          title: 'Validation Failed',
          status: 400,
          detail: error.message,
          code: ErrorCodes.VALIDATION_FAILED,
          instance: request.url,
          errors: validationError.validation || validationError.issues,
        };
        return reply.status(400).send(problem);
      }

      // 4. Default unexpected error (Internal Server Error)
      const requestId = request.id || 'req-unknown';
      request.log.error({ err: error, requestId }, 'Unhandled exception');
      const problem: ProblemDetails = {
        type: `https://errors.video-pipeline.local/${ErrorCodes.INTERNAL}`,
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected internal error occurred',
        code: ErrorCodes.INTERNAL,
        instance: request.url,
      };

      return reply.status(500).send(problem);
    }
  );
}
