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
import type { DefaultBodyType, PathParams } from 'msw';
import { type HttpHandler, HttpResponse, type HttpResponseResolver, http } from 'msw/http';
import type { z } from 'zod';

type WireResult<T extends EndpointContract> = Extract<z.input<T['result']>, DefaultBodyType>;

type WireParams<T extends EndpointContract> = PathParams<Extract<keyof ContractParams<T>, string>>;

type WireBody<T extends EndpointContract> =
  ContractBody<T> extends infer Body extends Record<string, unknown> | undefined ? Body : never;

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

/** `mockEndpoint` answering the contracts at `baseUrl`, the API base URL the app's client calls. */
export function createEndpointMocks(baseUrl: string) {
  function mockEndpoint<T extends EndpointContract>(
    contract: T,
    resolver: EndpointResolver<T>
  ): HttpHandler {
    return ROUTE_BY_METHOD[contract.method]<WireParams<T>, WireBody<T>, WireResult<T> | Problem>(
      `${baseUrl}${contract.path}`,
      resolver
    );
  }

  return { mockEndpoint };
}

export function problemReply(code: ErrorCode, status = problemStatus(code)): HttpResponse<Problem> {
  return HttpResponse.json(
    problemDetails({ code, status, title: code, detail: code, instance: 'msw' }),
    { status, headers: { 'content-type': PROBLEM_CONTENT_TYPE } }
  );
}
