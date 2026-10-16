import { createApiClient } from '@vp/api-client';

import { createEndpointMocks } from './mock-endpoint';

/** Where every client app calls the API when its build-time config is unset, so where a spec's handlers answer. */
export const LOCAL_API_BASE_URL = 'http://localhost:3000';

export const { mockEndpoint } = createEndpointMocks(LOCAL_API_BASE_URL);

/** A client at that address with no token: MSW answers whatever is asked, so a key or a call needs none. */
export const api = createApiClient({ baseUrl: LOCAL_API_BASE_URL });
