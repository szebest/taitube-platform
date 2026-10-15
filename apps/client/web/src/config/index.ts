import { EnvHostnameSchema, EnvUrlSchema, resolveApiBaseUrl } from '@vp/queries';
import { z } from 'zod';

export const IN_VIEW_LOCAL_STORAGE_KEY = 'IN_VIEW';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const DEFAULT_STUDIO_URL = 'http://localhost:5174';

declare const process: { env: Record<string, string | undefined> };

const BuildEnvSchema = z.object({
  VITE_API_BASE_URL: EnvUrlSchema,
  VITE_STUDIO_URL: EnvUrlSchema,
  VITE_COOKIE_DOMAIN: EnvHostnameSchema,
});

const buildEnv = BuildEnvSchema.parse(import.meta.env);

export const API_BASE_URL = resolveApiBaseUrl({
  ssr: import.meta.env.SSR,
  browser: buildEnv.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  serverEnv: import.meta.env.SSR ? process.env : {},
});

/** Where the creator studio is: the upload and edit paths redirect there, and the header links to it. */
export const STUDIO_URL = buildEnv.VITE_STUDIO_URL ?? DEFAULT_STUDIO_URL;

/** The parent domain both apps share, so the theme cookie follows the viewer between them; unset locally. */
export const COOKIE_DOMAIN = buildEnv.VITE_COOKIE_DOMAIN;
