import { createIsomorphicFn } from '@tanstack/react-start';
import { type ApiClient, createApiClient } from '@vp/api-client';
import { readSessionToken } from './session-cookie';

/** Where each client app answers its browser's API calls, on its own origin. */
export const API_PROXY_PATH = '/api';

export const UNAUTHORIZED = 401;

export type AppApiClientOptions = {
  /** Where the app's server reaches the API. */
  apiBaseUrl: string;
  /** Told of every 401 the browser receives, so a session that ended under the viewer closes. */
  onUnauthorized: () => void;
  /** The acting channel of an app that works on several; sent as `X-Channel-Id` on the endpoints that take one. */
  getChannelId?: () => string | undefined;
};

function reportingUnauthorized(onUnauthorized: () => void): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init);
    if (response.status === UNAUTHORIZED) onUnauthorized();
    return response;
  };
}

/**
 * The typed client of one router. The app's server calls the API at `apiBaseUrl` with the session
 * cookie's token; the browser calls its own origin's `/api`, whose proxy attaches that token
 * (`sessionMiddleware`), so no script ever holds it and the API is never a cross-origin call.
 */
export const createAppApiClient = createIsomorphicFn()
  .server(({ apiBaseUrl, getChannelId }: AppApiClientOptions): ApiClient =>
    createApiClient({ baseUrl: apiBaseUrl, getAuthToken: readSessionToken, getChannelId })
  )
  .client(({ onUnauthorized, getChannelId }: AppApiClientOptions): ApiClient =>
    createApiClient({
      baseUrl: `${window.location.origin}${API_PROXY_PATH}`,
      fetch: reportingUnauthorized(onUnauthorized),
      getChannelId,
    })
  );
