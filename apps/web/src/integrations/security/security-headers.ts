import { createNonce } from './nonce';

function securityHeaders(nonce: string): Record<string, string> {
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

export async function withSecurityHeaders<T extends { response: Response }>(
  render: (nonce: string) => Promise<T>
): Promise<T> {
  const nonce = createNonce();
  const rendered = await render(nonce);
  for (const [name, value] of Object.entries(securityHeaders(nonce))) {
    rendered.response.headers.set(name, value);
  }
  return rendered;
}
