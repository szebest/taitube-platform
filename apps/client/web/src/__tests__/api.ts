import { createAppApiClient } from '@vp/queries';
import { createEndpointMocks } from '@vp/web-testing';

import { API_BASE_URL } from '#app/config';

export const { mockEndpoint } = createEndpointMocks(API_BASE_URL);

export const api = createAppApiClient(API_BASE_URL);
