import { z } from 'zod';

export const AUTH_TOKEN_LOCAL_STORAGE_KEY = 'AUTH_TOKEN';

export const IN_VIEW_LOCAL_STORAGE_KEY = 'IN_VIEW';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

declare const process: { env: Record<string, string | undefined> };

const OptionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => value?.replace(/\/+$/, '') || undefined)
  .pipe(z.string().url().optional());

const BuildEnvSchema = z.object({ VITE_API_BASE_URL: OptionalUrl });

/**
 * Where the SSR server reaches the API, read when the server starts rather than inlined by the build:
 * inside compose or a cluster that is the API's service name, which no browser can resolve.
 */
function serverApiBaseUrl(): string | undefined {
  return z.object({ SSR_API_BASE_URL: OptionalUrl }).parse(process.env).SSR_API_BASE_URL;
}

const browserApiBaseUrl =
  BuildEnvSchema.parse(import.meta.env).VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;

export const API_BASE_URL =
  (import.meta.env.SSR ? serverApiBaseUrl() : undefined) ?? browserApiBaseUrl;

export const DEVTOOLS_ENABLED = import.meta.env.DEV;
