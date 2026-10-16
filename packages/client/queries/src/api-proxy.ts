import { createMiddleware } from '@tanstack/react-start';
import { getRequestIP } from '@tanstack/react-start/server';

import { API_PROXY_PATH } from './api-client';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);

/** What the browser may tell the API; never its cookies, which belong to the app's origin. */
const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'authorization',
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

function isProxied(pathname: string): boolean {
  return pathname === API_PROXY_PATH || pathname.startsWith(`${API_PROXY_PATH}/`);
}

/** The hops so far plus the browser this server answers, so the API's `TRUST_PROXY` finds the client. */
function forwardedFor(request: Request): string | undefined {
  const hops = [request.headers.get('x-forwarded-for'), getRequestIP()].filter(Boolean);
  return hops.length > 0 ? hops.join(', ') : undefined;
}

function forwardedHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const hops = forwardedFor(request);
  if (hops) headers.set('x-forwarded-for', hops);
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

/** Answers the browser's call to `/api/...` on this origin from the API at `apiBaseUrl`. */
export async function proxyToApi(request: Request, apiBaseUrl: string): Promise<Response> {
  const { pathname, search } = new URL(request.url);
  const answered = await fetch(`${apiBaseUrl}${pathname.slice(API_PROXY_PATH.length)}${search}`, {
    method: request.method,
    headers: forwardedHeaders(request),
    body: SAFE_METHODS.has(request.method) ? undefined : await request.arrayBuffer(),
    signal: request.signal,
  });
  return relayed(answered);
}

/**
 * The request middleware every client app's `src/start.ts` mounts after the security headers:
 * `/api/...` goes to the API, everything else renders.
 */
export function apiProxyMiddleware(apiBaseUrl: string) {
  return createMiddleware().server(({ pathname, request, next }) =>
    isProxied(pathname) ? proxyToApi(request, apiBaseUrl) : next()
  );
}
