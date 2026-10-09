import { withSecurityHeaders } from '../security-headers';

async function renderedHeaders() {
  const nonces: string[] = [];
  const { response } = await withSecurityHeaders(async (nonce) => {
    nonces.push(nonce);
    return { response: new Response('<html></html>') };
  });
  return { headers: response.headers, nonce: nonces[0] };
}

describe('apps/client/web: security headers', () => {
  it('allows only scripts carrying the nonce it handed the render, and what they load', async () => {
    const { headers, nonce } = await renderedHeaders();

    expect(headers.get('Content-Security-Policy')).toBe(
      `script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`
    );
  });

  it.each([
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ])('answers with %s: %s', async (name, value) => {
    const { headers } = await renderedHeaders();

    expect(headers.get(name)).toBe(value);
  });
});
