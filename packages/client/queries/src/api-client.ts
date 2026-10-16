import { type ApiClient, createApiClient } from '@vp/api-client';

import { readAuthToken } from './auth-token';

/** The typed client at `baseUrl`, authenticated with the token the viewer stored. */
export function createAppApiClient(baseUrl: string): ApiClient {
  return createApiClient({ baseUrl, getAuthToken: readAuthToken });
}
