import { createApiClient } from '@vp/api-client';
import { http } from 'msw/http';

import { createEndpointMocks } from './mock-endpoint';

/** Where every client app calls the API when its build-time config is unset, so where a spec's handlers answer. */
export const LOCAL_API_BASE_URL = 'http://localhost:3000';

export const { mockEndpoint } = createEndpointMocks(LOCAL_API_BASE_URL);

/** A client at that address with no token: MSW answers whatever is asked, so a key or a call needs none. */
export const api = createApiClient({ baseUrl: LOCAL_API_BASE_URL });

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);

/**
 * What each app's same-origin `/api` proxy does once the session is attached, which its own spec
 * owns: the browser's call goes on to the local API, where the spec's `mockEndpoint` answers it.
 */
export const sameOriginApiProxy = http.all('*/api/*', async ({ request }) => {
  const { pathname, search } = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  return fetch(`${LOCAL_API_BASE_URL}${pathname.slice('/api'.length)}${search}`, {
    method: request.method,
    headers,
    body: SAFE_METHODS.has(request.method) ? undefined : await request.arrayBuffer(),
  });
});
