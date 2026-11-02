import { createStart } from '@tanstack/react-start';
import { sessionMiddleware } from '@vp/queries';
import { clientAppRequestMiddlewareFor } from '@vp/security-headers';

import { API_BASE_URL, COOKIE_DOMAIN } from './config';
import { EMBED_PATH_PREFIX } from './features/embed/embed-path';

export const startInstance = createStart(() => ({
  requestMiddleware: [
    ...clientAppRequestMiddlewareFor({ embeddablePrefix: EMBED_PATH_PREFIX }),
    sessionMiddleware({ apiBaseUrl: API_BASE_URL, cookieDomain: COOKIE_DOMAIN }),
  ],
}));
