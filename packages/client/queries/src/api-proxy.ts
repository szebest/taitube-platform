import { getRequestIP } from '@tanstack/react-start/server';
import {
  CHANNEL_HEADER,
  PROBLEM_CONTENT_TYPE,
  type ProblemInput,
  problemDetails,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { withExpired } from './accounts';
import { readAccounts, writeAccounts } from './accounts-cookie';
import { API_PROXY_PATH, UNAUTHORIZED } from './api-client';
import type { SessionConfig } from './session-config';
import { clearSessionCookie, readSessionToken, writeSessionCookie } from './session-cookie';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);

/** The API's `HTTP_BODY_LIMIT_BYTES` default (`@vp/env-schema`): it would refuse a bigger body anyway. */
const PROXY_BODY_LIMIT_BYTES = 1_048_576;

const PAYLOAD_TOO_LARGE = 413;

const FORBIDDEN = 403;

/** What the browser may tell the API. Never its cookies: the session goes as the bearer, alone. */
const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'content-type',
  'if-none-match',
  CHANNEL_HEADER,
  'last-event-id',
  'traceparent',
  'tracestate',
];

/** What `fetch` already consumed (the encoding it decoded, the framing) or this origin must not take. */
const DROPPED_RESPONSE_HEADERS = [
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'set-cookie',
  'transfer-encoding',
];

const noRefresh = async () => undefined;

type ReadBody =
  | { readonly status: 'read'; readonly body?: Blob }
  | { readonly status: 'too-large' };

/** The body, held whole for a retry after a refresh, and refused past the limit however it is framed. */
async function readBody(request: Request): Promise<ReadBody> {
  if (SAFE_METHODS.has(request.method) || !request.body) return { status: 'read' };
  if (Number(request.headers.get('content-length')) > PROXY_BODY_LIMIT_BYTES) {
    return { status: 'too-large' };
  }

  const reader = request.body.getReader();
  const chunks: BlobPart[] = [];
  let size = 0;
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    size += read.value.byteLength;
    if (size > PROXY_BODY_LIMIT_BYTES) {
      await reader.cancel();
      return { status: 'too-large' };
    }
    chunks.push(read.value);
  }
  return { status: 'read', body: new Blob(chunks) };
}

function refusal(request: Request, refused: Omit<ProblemInput, 'instance'>): Response {
  const problem = problemDetails({ ...refused, instance: new URL(request.url).pathname });
  return Response.json(problem, {
    status: refused.status,
    headers: { 'content-type': PROBLEM_CONTENT_TYPE },
  });
}

/** The hops so far plus the browser this server answers, so the API's `TRUST_PROXY` finds the client. */
export function forwardedFor(request: Request): string | undefined {
  const hops = [request.headers.get('x-forwarded-for'), getRequestIP()].filter(Boolean);
  return hops.length > 0 ? hops.join(', ') : undefined;
}

function forwardedHeaders(request: Request, token: string | undefined): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const hops = forwardedFor(request);
  if (hops) headers.set('x-forwarded-for', hops);
  if (token) headers.set('authorization', `Bearer ${token}`);
  return headers;
}

function relayed(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const name of DROPPED_RESPONSE_HEADERS) headers.delete(name);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Answers the browser's call to `/api/...` on this origin from the API, with the token of `slot`
 * (the `X-Account-Slot` the browser sent) as the bearer. A write that names no slot is refused, so
 * a cross-site form, which cannot set that header, writes nothing. A token the API refuses is
 * refreshed once and the call retried; with no refresh to be had that slot alone is cleared and
 * marked expired, the 401 goes back, and the browser signs that slot in again. `refresh` is
 * single-flight per token (`sessionMiddleware`), so parallel 401s share one.
 */
export async function proxyToApi(
  request: Request,
  { apiBaseUrl, cookieDomain, refresh = noRefresh }: SessionConfig,
  { pathname, slot }: { pathname: string; slot: number | undefined }
): Promise<Response> {
  if (slot === undefined) {
    return refusal(request, {
      code: ErrorCodes.FORBIDDEN,
      status: FORBIDDEN,
      title: 'Forbidden',
      detail: 'A write names its account slot',
    });
  }
  const url = `${apiBaseUrl}${pathname.slice(API_PROXY_PATH.length)}${new URL(request.url).search}`;
  const read = await readBody(request);
  if (read.status === 'too-large') {
    return refusal(request, {
      code: ErrorCodes.VALIDATION_FAILED,
      status: PAYLOAD_TOO_LARGE,
      title: 'Payload Too Large',
      detail: `The body is over ${PROXY_BODY_LIMIT_BYTES} bytes`,
    });
  }
  const forward = (token: string | undefined) =>
    fetch(url, {
      method: request.method,
      headers: forwardedHeaders(request, token),
      body: read.body,
      signal: request.signal,
    });

  const token = readSessionToken(slot);
  const answered = await forward(token);
  if (answered.status !== UNAUTHORIZED || token === undefined) return relayed(answered);

  const refreshed = await refresh(token);
  if (refreshed !== undefined) {
    writeSessionCookie(slot, refreshed, cookieDomain);
    return relayed(await forward(refreshed));
  }

  clearSessionCookie(slot, cookieDomain);
  writeAccounts(withExpired(readAccounts(), slot), cookieDomain);
  return relayed(answered);
}
