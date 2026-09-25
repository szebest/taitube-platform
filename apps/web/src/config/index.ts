import { z } from 'zod';

export const AUTH_TOKEN_LOCAL_STORAGE_KEY = 'AUTH_TOKEN';

export const IN_VIEW_LOCAL_STORAGE_KEY = 'IN_VIEW';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

const WebEnvSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .pipe(z.string().url().optional()),
});

export function parseWebEnv(env: Record<string, unknown>) {
  const { VITE_API_BASE_URL } = WebEnvSchema.parse(env);
  return {
    apiBaseUrl: VITE_API_BASE_URL?.replace(/\/+$/, '') ?? DEFAULT_API_BASE_URL,
  };
}

export const API_BASE_URL = parseWebEnv(import.meta.env).apiBaseUrl;

export const DEVTOOLS_ENABLED = import.meta.env.DEV;
