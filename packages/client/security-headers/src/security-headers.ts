import { createMiddleware } from '@tanstack/react-start';

import { createNonce } from './nonce';

export interface SecurityHeadersOptions {
  /** Paths under this prefix may be framed by any site; every other path may be framed by none. */
  embeddablePrefix?: string;
}

function securityHeaders(nonce: string, embeddable: boolean): Record<string, string> {
  return {
    'Content-Security-Policy': [
      `script-src 'nonce-${nonce}' 'strict-dynamic'`,
      "object-src 'none'",
      "base-uri 'self'",
      `frame-ancestors ${embeddable ? '*' : "'none'"}`,
      "form-action 'self'",
    ].join('; '),
    ...(embeddable ? {} : { 'X-Frame-Options': 'DENY' }),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

export function createSecurityHeadersMiddleware({ embeddablePrefix }: SecurityHeadersOptions = {}) {
  return createMiddleware().server(async ({ next, pathname }) => {
    const nonce = createNonce();
    const rendered = await next({ context: { nonce } });
    const embeddable = embeddablePrefix !== undefined && pathname.startsWith(embeddablePrefix);
    for (const [name, value] of Object.entries(securityHeaders(nonce, embeddable))) {
      rendered.response.headers.set(name, value);
    }
    return rendered;
  });
}

export const securityHeadersMiddleware = createSecurityHeadersMiddleware();
