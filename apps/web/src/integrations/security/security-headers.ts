import { createMiddleware } from '@tanstack/react-start';

const NONCE_BYTES = 16;

export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  return btoa(String.fromCharCode(...bytes));
}

export function securityHeaders(nonce: string): Record<string, string> {
  return {
    'Content-Security-Policy': [
      `script-src 'nonce-${nonce}' 'strict-dynamic'`,
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

export const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const nonce = createNonce();
  const rendered = await next({ context: { nonce } });
  for (const [name, value] of Object.entries(securityHeaders(nonce))) {
    rendered.response.headers.set(name, value);
  }
  return rendered;
});
