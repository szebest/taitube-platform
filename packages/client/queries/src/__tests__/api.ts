import { createEndpointMocks } from '@vp/web-testing';

import { createAppApiClient } from '../api-client';

const BASE_URL = 'http://localhost:3000';

export const { mockEndpoint } = createEndpointMocks(BASE_URL);

export const api = createAppApiClient(BASE_URL);
