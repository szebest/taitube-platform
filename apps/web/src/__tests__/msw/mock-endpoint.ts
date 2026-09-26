import {
  type ContractBody,
  type ContractParams,
  type EndpointContract,
  PROBLEM_CONTENT_TYPE,
  type Problem,
  problemDetails,
  problemStatus,
} from '@vp/api-contracts';
import type { ErrorCode } from '@vp/errors';
import {
  http,
  type HttpHandler,
  HttpResponse,
  type HttpResponseResolver,
  type PathParams,
} from 'msw';
import type { z } from 'zod';

import { API_BASE_URL } from '#app/config';

type WireResult<T extends EndpointContract> = z.input<T['result']>;

type WireParams<T extends EndpointContract> = PathParams<Extract<keyof ContractParams<T>, string>>;

type WireBody<T extends EndpointContract> = ContractBody<T> extends infer Body extends
  | Record<string, unknown>
  | undefined
  ? Body
  : never;

export type EndpointResolver<T extends EndpointContract> = HttpResponseResolver<
  WireParams<T>,
  WireBody<T>,
  WireResult<T> | Problem
>;

const ROUTE_BY_METHOD = {
  GET: http.get,
  POST: http.post,
  PUT: http.put,
  PATCH: http.patch,
  DELETE: http.delete,
} satisfies Record<EndpointContract['method'], typeof http.get>;

/**
 * An MSW handler for one `@vp/api-contracts` endpoint, at the URL the app's `apiClient` calls. The
 * resolver answers with the contract's result as it travels on the wire, or with a problem.
 */
export function mockEndpoint<T extends EndpointContract>(
  contract: T,
  resolver: EndpointResolver<T>
): HttpHandler {
  return ROUTE_BY_METHOD[contract.method]<WireParams<T>, WireBody<T>, WireResult<T> | Problem>(
    `${API_BASE_URL}${contract.path}`,
    resolver
  );
}

/** The RFC 9457 body the API answers `code` with, at the status the API reports it as. */
export function problemReply(code: ErrorCode, status = problemStatus(code)): HttpResponse<Problem> {
  return HttpResponse.json(
    problemDetails({ code, status, title: code, detail: code, instance: 'msw' }),
    { status, headers: { 'content-type': PROBLEM_CONTENT_TYPE } }
  );
}
