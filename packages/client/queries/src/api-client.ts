import { createIsomorphicFn } from '@tanstack/react-start';
import { type ApiClient, createApiClient } from '@vp/api-client';

import { readAuthToken } from './auth-token';

/** Where each client app answers its browser's API calls, on its own origin. */
export const API_PROXY_PATH = '/api';

/**
 * The typed client of one router, authenticated with the token the viewer stored. The app's server
 * calls the API at `apiBaseUrl`; the browser calls its own origin's `/api`, which that server
 * forwards (`apiProxyMiddleware`), so the API is never a cross-origin call.
 */
export const createAppApiClient = createIsomorphicFn()
  .server(
    (apiBaseUrl: string): ApiClient =>
      createApiClient({ baseUrl: apiBaseUrl, getAuthToken: readAuthToken })
  )
  .client(
    (_apiBaseUrl: string): ApiClient =>
      createApiClient({
        baseUrl: `${window.location.origin}${API_PROXY_PATH}`,
        getAuthToken: readAuthToken,
      })
  );
