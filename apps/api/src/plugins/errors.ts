import { STATUS_CODES } from 'node:http';
import type { Socket } from 'node:net';
import {
  PROBLEM_CONTENT_TYPE,
  type Problem,
  problemDetails,
  problemStatus,
} from '@vp/api-contracts';
import { type ErrorCode, ErrorCodes, PipelineError } from '@vp/errors';
import type {
  ConnectionError,
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

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

/** The vocabulary's name for a Fastify 4xx; a status with none reads as a request that failed validation. */
const TRANSPORT_CODES: ReadonlyMap<number, ErrorCode> = new Map([
  [401, ErrorCodes.UNAUTHORIZED],
  [403, ErrorCodes.FORBIDDEN],
  [415, ErrorCodes.UNSUPPORTED_CONTENT_TYPE],
]);

/** The statuses Fastify's own client error handler answers Node's parser failures with. */
const CLIENT_ERROR_STATUS: ReadonlyMap<string, number> = new Map([
  ['ERR_HTTP_REQUEST_TIMEOUT', 408],
  ['HPE_HEADER_OVERFLOW', 431],
]);

function transportProblem(status: number, detail: string, instance: string): Problem {
  return problemDetails({
    code: TRANSPORT_CODES.get(status) ?? ErrorCodes.VALIDATION_FAILED,
    title: STATUS_CODES[status] ?? 'Client Error',
    status,
    detail,
    instance,
  });
}

export function rateLimitProblem(instance: string, detail = 'Rate limit exceeded'): Problem {
  return problemDetails({
    code: ErrorCodes.RATE_LIMITED,
    title: 'Too Many Requests',
    status: 429,
    detail,
    instance,
  });
}

function domainProblem(code: string, message: string, instance: string): Problem {
  return problemDetails({
    code,
    title: message || 'Domain Error',
    status: problemStatus(code),
    detail: message,
    instance,
  });
}

export function problemErrorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): FastifyReply {
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

  if (errorStatusCode !== undefined && errorStatusCode >= 400 && errorStatusCode < 500) {
    return reply
      .status(errorStatusCode)
      .send(transportProblem(errorStatusCode, error.message, request.url));
  }

  request.log.error({ err: error }, 'unhandled exception');
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

/** Answers a request Node's HTTP parser refused, which never reaches the error handler. */
export function problemClientErrorHandler(error: ConnectionError, socket: Socket): void {
  if (error.code === 'ECONNRESET' || socket.destroyed) return;

  if (socket.writable) {
    const status = CLIENT_ERROR_STATUS.get(error.code) ?? 400;
    const body = JSON.stringify(transportProblem(status, error.message, ''));
    socket.write(
      [
        `HTTP/1.1 ${status} ${STATUS_CODES[status]}`,
        `Content-Type: ${PROBLEM_CONTENT_TYPE}`,
        `Content-Length: ${Buffer.byteLength(body)}`,
        'Connection: close',
        '',
        body,
      ].join('\r\n')
    );
  }
  socket.destroy(error);
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(problemErrorHandler);
  app.setNotFoundHandler((request, reply) =>
    reply
      .status(404)
      .header('content-type', PROBLEM_CONTENT_TYPE)
      .send(
        problemDetails({
          code: ErrorCodes.ROUTE_NOT_FOUND,
          title: 'Not Found',
          status: 404,
          detail: `Route ${request.method}:${request.url} not found`,
          instance: request.url,
        })
      )
  );
}
