/** Headers that carry a credential, and never reach a log line. */
export const CREDENTIAL_HEADERS: ReadonlySet<string> = new Set([
  'authorization',
  'cookie',
  'x-admin-token',
]);

export const REDACTED = '[Redacted]';
