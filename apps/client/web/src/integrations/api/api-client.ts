import { createApiClient } from '@vp/api-client';

import { readAuthToken } from '#app/auth-token';
import { API_BASE_URL } from '#app/config';

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  getAuthToken: readAuthToken,
});
