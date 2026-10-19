import { z } from 'zod';

/** A URL from the environment: trimmed, trailing slashes dropped, and empty read as unset. */
export const EnvUrlSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value?.replace(/\/+$/, '') || undefined)
  .pipe(z.url().optional());

/** A hostname from the environment, trimmed, and empty read as unset. */
export const EnvHostnameSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .pipe(z.hostname().optional());

const ServerEnvSchema = z.object({ SSR_API_BASE_URL: EnvUrlSchema });

export type ApiBaseUrlSources = {
  /** The address the build inlined from `VITE_API_BASE_URL`, or the app's local default. */
  built: string;
  /**
   * The app server's own environment, read when it starts: inside compose or a cluster
   * `SSR_API_BASE_URL` is the API's service name, which only that network resolves.
   */
  serverEnv: Readonly<Record<string, string | undefined>>;
};

/** Where the app's server reaches the API; the browser never does, it calls the app's own `/api`. */
export function resolveApiBaseUrl({ built, serverEnv }: ApiBaseUrlSources): string {
  return ServerEnvSchema.parse(serverEnv).SSR_API_BASE_URL ?? built;
}
