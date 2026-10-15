import { z } from 'zod';

/** A URL from the environment: trimmed, trailing slashes dropped, and empty read as unset. */
export const EnvUrlSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value?.replace(/\/+$/, '') || undefined)
  .pipe(z.url().optional());

const ServerEnvSchema = z.object({ SSR_API_BASE_URL: EnvUrlSchema });

export type ApiBaseUrlSources = {
  /** Whether this is the SSR server rendering, `import.meta.env.SSR` in the app. */
  ssr: boolean;
  /** Where the browser reaches the API, inlined by the build from `VITE_API_BASE_URL`. */
  browser: string;
  /**
   * The SSR server's own environment, read when it starts: inside compose or a cluster
   * `SSR_API_BASE_URL` is the API's service name, which no browser can resolve.
   */
  serverEnv: Readonly<Record<string, string | undefined>>;
};

export function resolveApiBaseUrl({ ssr, browser, serverEnv }: ApiBaseUrlSources): string {
  if (!ssr) return browser;
  return ServerEnvSchema.parse(serverEnv).SSR_API_BASE_URL ?? browser;
}
