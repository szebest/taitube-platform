import { EnvHostnameSchema, EnvUrlSchema, resolveApiBaseUrl } from '@vp/queries';
import { z } from 'zod';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const DEFAULT_WEB_URL = 'http://localhost:5173';

declare const process: { env: Record<string, string | undefined> };

const BuildEnvSchema = z.object({
  VITE_API_BASE_URL: EnvUrlSchema,
  VITE_WEB_URL: EnvUrlSchema,
  VITE_COOKIE_DOMAIN: EnvHostnameSchema,
});

const buildEnv = BuildEnvSchema.parse(import.meta.env);

/** Where this app's server reaches the API; the browser calls this origin's `/api` instead. */
export const API_BASE_URL = resolveApiBaseUrl({
  built: buildEnv.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  serverEnv: import.meta.env.SSR ? process.env : {},
});

/** Where the viewer-facing app is: the studio links back to it, and to the videos it publishes. */
export const WEB_URL = buildEnv.VITE_WEB_URL ?? DEFAULT_WEB_URL;

/** The parent domain both apps share, so theme and session follow the viewer; unset locally. */
export const COOKIE_DOMAIN = buildEnv.VITE_COOKIE_DOMAIN;
