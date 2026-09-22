import { problemFor } from '@vp/api-contracts';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendResult } from '../../send-result';

type Forbidden = { readonly code: 'FORBIDDEN'; readonly message: string; readonly videoId: string };
type Reachable = Result<{ id: string }, Forbidden | DatabaseUnavailable>;

declare const reply: FastifyReply;
declare const request: FastifyRequest;
declare const result: Reachable;

export function overridesAReachableCode(): FastifyReply {
  return sendResult(reply, request, result, {
    on: { FORBIDDEN: (failure) => problemFor(failure, request.url, { status: 404 }) },
  });
}

export function overridesACodeTheServiceCannotReturn(): FastifyReply {
  return sendResult(reply, request, result, {
    // @ts-expect-error the service cannot return UPLOAD_TOO_LARGE, so there is nothing to override
    on: { UPLOAD_TOO_LARGE: (failure) => problemFor(failure, request.url) },
  });
}
