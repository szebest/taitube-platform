import { clientAppRequestMiddlewareFor } from '@kit/security-headers';
import { createStart } from '@tanstack/react-start';
import { sessionMiddleware } from '@vp/queries';
import { EMBED_PATH_PREFIX } from '#app/features/embed';
import { ACCOUNTS_MAX, API_BASE_URL, COOKIE_DOMAIN, DEV_TOKEN_URL, STUDIO_URL } from './lib/config';

export const startInstance = createStart(() => ({
  requestMiddleware: [
    ...clientAppRequestMiddlewareFor({
      embeddablePrefix: EMBED_PATH_PREFIX,
      draftPreview: { pathPrefix: '/channels/', framedBy: new URL(STUDIO_URL).origin },
    }),
    sessionMiddleware({
      apiBaseUrl: API_BASE_URL,
      cookieDomain: COOKIE_DOMAIN,
      devTokenUrl: DEV_TOKEN_URL,
      accountsMax: ACCOUNTS_MAX,
    }),
  ],
}));
