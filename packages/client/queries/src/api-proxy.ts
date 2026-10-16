import { getRequestIP } from '@tanstack/react-start/server';

import { API_PROXY_PATH, UNAUTHORIZED } from './api-client';
import type { SessionConfig } from './session-config';
import { clearSessionCookie, readSessionToken, writeSessionCookie } from './session-cookie';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);

/** What the browser may tell the API. Never its cookies: the session goes as the bearer, alone. */
const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'content-type',
  'if-none-match',
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

/** The hops so far plus the browser this server answers, so the API's `TRUST_PROXY` finds the client. */
function forwardedFor(request: Request): string | undefined {
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
 * Answers the browser's call to `/api/...` on this origin from the API, with the session cookie's
 * token as the bearer. A token the API refuses is refreshed once and the call retried; with no
 * refresh to be had the cookie is cleared and the 401 goes back, and the browser signs in again.
 */
export async function proxyToApi(
  request: Request,
  { apiBaseUrl, cookieDomain, refresh = noRefresh }: SessionConfig
): Promise<Response> {
  const { pathname, search } = new URL(request.url);
  const url = `${apiBaseUrl}${pathname.slice(API_PROXY_PATH.length)}${search}`;
  const body = SAFE_METHODS.has(request.method) ? undefined : await request.arrayBuffer();
  const forward = (token: string | undefined) =>
    fetch(url, {
      method: request.method,
      headers: forwardedHeaders(request, token),
      body,
      signal: request.signal,
    });

  const token = readSessionToken();
  const answered = await forward(token);
  if (answered.status !== UNAUTHORIZED || token === undefined) return relayed(answered);

  const refreshed = await refresh();
  if (refreshed !== undefined) {
    writeSessionCookie(refreshed, cookieDomain);
    return relayed(await forward(refreshed));
  }

  clearSessionCookie(cookieDomain);
  return relayed(answered);
}
