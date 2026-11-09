import { parseClientEnv } from '@vp/queries';

declare const process: { env: Record<string, string | undefined> };

const env = parseClientEnv({
  env: import.meta.env,
  serverEnv: import.meta.env.SSR ? process.env : {},
});

export const API_BASE_URL = env.apiBaseUrl;

/** The API's address as the browser reaches it, for what the `/api` proxy cannot carry: the chat socket, Bull Board. */
export const API_PUBLIC_URL = env.apiPublicUrl;

/** Bull Board, which the API serves; a link the browser follows, so the public address, never the server's own. */
export const BULL_BOARD_URL = `${API_PUBLIC_URL}/admin/queues`;

/** Where the viewer-facing app is: the studio links back to it, and to the videos it publishes. */
export const WEB_URL = env.webUrl;

export const COOKIE_DOMAIN = env.cookieDomain;

export const OTEL_TRACES_URL = env.tracesUrl;

/** Where this app's server reaches `dev-token serve`, which mints the personas' tokens; unset means its local address. */
export const DEV_TOKEN_URL = env.devTokenUrl;
