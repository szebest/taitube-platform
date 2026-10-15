import { createAppApiClient } from '@vp/queries';

import { API_BASE_URL } from '#app/config';

export const api = createAppApiClient(API_BASE_URL);
