import { createIsomorphicFn } from '@tanstack/react-start';
import { type ApiClient, createApiClient } from '@vp/api-client';
import { VIEWER_SESSION_HEADER } from '@vp/api-contracts';
import { ACCOUNT_SLOT_HEADER } from './account-slots';
import { readSessionToken, withVideoAccessCookies } from './session-cookie';

/** Where each client app answers its browser's API calls, on its own origin. */
export const API_PROXY_PATH = '/api';

export const UNAUTHORIZED = 401;

export type AppApiClientOptions = {
  /** Where the app's server reaches the API. */
  apiBaseUrl: string;
  /** The slot this router acts as, read on every call, so a switch moves the next call and not the last. */
  getSlot: () => number;
  /** Told of every 401 the browser receives, with the slot the call went as, so a session that ended under the viewer closes. */
  onUnauthorized: (slot: number) => void;
  /** The acting channel, sent as `X-Channel-Id` on the endpoints that take one. */
  getChannelId?: () => string | undefined;
  /**
   * The browser tab's ephemeral key, sent as `x-viewer-session` so the API picks one test variant
   * per tab. The server never sends one, so a server render always carries the control.
   */
  getViewerSession?: () => string;
};

function asSlot(getSlot: () => number, onUnauthorized: (slot: number) => void): typeof fetch {
  return async (input, init) => {
    const slot = getSlot();
    const headers = new Headers(init?.headers);
    headers.set(ACCOUNT_SLOT_HEADER, String(slot));
    const response = await fetch(input, { ...init, headers });
    if (response.status === UNAUTHORIZED) onUnauthorized(slot);
    return response;
  };
}

/**
 * The typed client of one router. The app's server calls the API at `apiBaseUrl` with the token of
 * the router's slot; the browser calls its own origin's `/api` naming the slot in `X-Account-Slot`,
 * whose proxy attaches that slot's token (`sessionMiddleware`), so no script ever holds it and the
 * API is never a cross-origin call.
 */
export const createAppApiClient = createIsomorphicFn()
  .server(({ apiBaseUrl, getSlot, getChannelId }: AppApiClientOptions): ApiClient =>
    createApiClient({
      baseUrl: apiBaseUrl,
      fetch: withVideoAccessCookies,
      getAuthToken: () => readSessionToken(getSlot()),
      getChannelId,
    })
  )
  .client(
    ({ getSlot, onUnauthorized, getChannelId, getViewerSession }: AppApiClientOptions): ApiClient =>
      createApiClient({
        baseUrl: `${window.location.origin}${API_PROXY_PATH}`,
        fetch: asSlot(getSlot, onUnauthorized),
        getChannelId,
        headers: getViewerSession && { [VIEWER_SESSION_HEADER]: getViewerSession() },
      })
  );
