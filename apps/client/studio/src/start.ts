import { createStart } from '@tanstack/react-start';
import { sessionMiddleware } from '@vp/queries';
import { clientAppRequestMiddleware } from '@vp/security-headers';

import { API_BASE_URL, COOKIE_DOMAIN } from './config';

export const startInstance = createStart(() => ({
  requestMiddleware: [
    ...clientAppRequestMiddleware,
    sessionMiddleware({ apiBaseUrl: API_BASE_URL, cookieDomain: COOKIE_DOMAIN }),
  ],
}));
