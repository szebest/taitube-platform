import { createNonce, securityHeaders } from '../security-headers';

describe('apps/web: security headers', () => {
  it('allows only scripts carrying the request nonce, and what they load', () => {
    expect(securityHeaders('abc')['Content-Security-Policy']).toBe(
      "script-src 'nonce-abc' 'strict-dynamic'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
    );
  });

  it.each([
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ])('sends %s: %s', (name, value) => {
    expect(securityHeaders('abc')[name]).toBe(value);
  });

  it('makes a fresh base64 nonce of 128 bits for every request', () => {
    const first = createNonce();

    expect(atob(first)).toHaveLength(16);
    expect(createNonce()).not.toBe(first);
  });
});
