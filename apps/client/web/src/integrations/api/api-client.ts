import { createAppApiClient } from '@vp/queries';

import { API_BASE_URL } from '#app/config';

export const apiClient = createAppApiClient(API_BASE_URL);
