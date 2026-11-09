import { EnvUrlSchema, parseClientEnv } from '@vp/queries';

const DEFAULT_STUDIO_URL = 'http://localhost:5174';

declare const process: { env: Record<string, string | undefined> };

const env = parseClientEnv({
  env: import.meta.env,
  serverEnv: import.meta.env.SSR ? process.env : {},
});

export const API_BASE_URL = env.apiBaseUrl;

export const API_PUBLIC_URL = env.apiPublicUrl;

/** Where the creator studio is: the upload and edit paths redirect there, and the header links to it. */
export const STUDIO_URL = EnvUrlSchema.parse(import.meta.env.VITE_STUDIO_URL) ?? DEFAULT_STUDIO_URL;

/** This app's public origin: the canonical, OpenGraph and sitemap URLs are absolute on it. */
export const WEB_URL = env.webUrl;

export const COOKIE_DOMAIN = env.cookieDomain;

export const OTEL_TRACES_URL = env.tracesUrl;
