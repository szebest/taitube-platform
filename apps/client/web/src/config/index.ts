import { EnvUrlSchema, resolveApiBaseUrl } from '@vp/queries';
import { z } from 'zod';

export const IN_VIEW_LOCAL_STORAGE_KEY = 'IN_VIEW';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

declare const process: { env: Record<string, string | undefined> };

const BuildEnvSchema = z.object({ VITE_API_BASE_URL: EnvUrlSchema });

const buildEnv = BuildEnvSchema.parse(import.meta.env);

export const API_BASE_URL = resolveApiBaseUrl({
  ssr: import.meta.env.SSR,
  browser: buildEnv.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  serverEnv: import.meta.env.SSR ? process.env : {},
});
