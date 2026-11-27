import { z } from 'zod';
import { EnvHostnameSchema, EnvUrlSchema, resolveApiBaseUrl } from './api-base-url';
import { ACCOUNTS_MAX_DEFAULT } from './session-config';

export const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const DEFAULT_WEB_URL = 'http://localhost:5173';

const ClientEnvSchema = z.object({
  VITE_API_BASE_URL: EnvUrlSchema,
  VITE_API_PUBLIC_URL: EnvUrlSchema,
  VITE_WEB_URL: EnvUrlSchema,
  VITE_COOKIE_DOMAIN: EnvHostnameSchema,
  VITE_OTEL_TRACES_URL: EnvUrlSchema,
  // Read by the persona switcher's lazy import itself, which must compare the literal for the build to drop it.
  VITE_DEMO_PERSONAS: z.enum(['true', 'false', '']).optional(),
});

const ServerEnvSchema = z.object({
  SSR_DEV_TOKEN_URL: EnvUrlSchema,
  ACCOUNTS_MAX: z
    .union([z.literal(''), z.coerce.number().int().min(1).max(ACCOUNTS_MAX_DEFAULT)])
    .optional()
    .transform((max) => (typeof max === 'number' ? max : ACCOUNTS_MAX_DEFAULT)),
});

export interface ClientEnvSources {
  /** The build's `import.meta.env`. */
  env: Readonly<Record<string, unknown>>;
  /** The app server's own environment on the server, empty in the browser. */
  serverEnv: Readonly<Record<string, string | undefined>>;
}

export interface ClientEnv {
  /** Where this app's server reaches the API; the browser calls this origin's `/api` instead. */
  apiBaseUrl: string;
  /** The API's address as the browser reaches it, for what the `/api` proxy cannot carry: the chat socket. */
  apiPublicUrl: string;
  /** The viewer-facing app's public origin. */
  webUrl: string;
  /** The parent domain both apps share, so theme and session follow the viewer; unset locally. */
  cookieDomain: string | undefined;
  tracesUrl: string | undefined;
  /** Where this app's server reaches `dev-token serve` for the personas; unset means its local address. */
  devTokenUrl: string | undefined;
  /** How many accounts one browser may hold at once; the server enforces it, so the browser reads the default. */
  accountsMax: number;
}

/** The keys both apps read from the build environment; a value the schema refuses stops the app from starting. */
export function parseClientEnv({ env, serverEnv }: ClientEnvSources): ClientEnv {
  const parsed = ClientEnvSchema.parse(env);
  const server = ServerEnvSchema.parse(serverEnv);

  return {
    apiBaseUrl: resolveApiBaseUrl({
      built: parsed.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
      serverEnv,
    }),
    apiPublicUrl: parsed.VITE_API_PUBLIC_URL ?? DEFAULT_API_BASE_URL,
    webUrl: parsed.VITE_WEB_URL ?? DEFAULT_WEB_URL,
    cookieDomain: parsed.VITE_COOKIE_DOMAIN,
    tracesUrl: parsed.VITE_OTEL_TRACES_URL,
    devTokenUrl: server.SSR_DEV_TOKEN_URL,
    accountsMax: server.ACCOUNTS_MAX,
  };
}
