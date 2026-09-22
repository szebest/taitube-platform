export const AUTH_TOKEN_LOCAL_STORAGE_KEY = 'AUTH_TOKEN';

export const IN_VIEW_LOCAL_STORAGE_KEY = 'IN_VIEW';

/** Where the API sits when the build was not given `REACT_APP_API_BASE_URL`. */
export const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export function resolveApiBaseUrl(env: Record<string, string | undefined>): string {
  const configured = env['REACT_APP_API_BASE_URL']?.trim();
  return configured ? configured.replace(/\/+$/, '') : DEFAULT_API_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl(process.env);
