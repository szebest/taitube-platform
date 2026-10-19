import { createMiddleware } from '@tanstack/react-start';

import { API_PROXY_PATH } from './api-client';
import { proxyToApi } from './api-proxy';
import type { SessionConfig } from './session-config';
import { singleFlightRefresh } from './single-flight-refresh';

function isProxied(pathname: string): boolean {
  return pathname === API_PROXY_PATH || pathname.startsWith(`${API_PROXY_PATH}/`);
}

/**
 * The request middleware every client app's `src/start.ts` mounts after the CSRF check and the
 * security headers: it answers `/api/...` from the API, and hands every other request, server
 * functions included, the domain the session cookie is written for.
 */
export function sessionMiddleware({ refresh, ...config }: SessionConfig) {
  const proxied: SessionConfig = { ...config, refresh: refresh && singleFlightRefresh(refresh) };
  return createMiddleware().server(({ pathname, request, next }) =>
    isProxied(pathname)
      ? proxyToApi(request, proxied)
      : next({ context: { sessionCookieDomain: config.cookieDomain } })
  );
}
