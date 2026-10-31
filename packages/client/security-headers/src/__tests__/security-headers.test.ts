import { createSecurityHeadersMiddleware, securityHeadersMiddleware } from '../security-headers';

async function renderedHeaders(pathname = '/', middleware = securityHeadersMiddleware) {
  const request = new Request(`http://localhost:5173${pathname}`);
  const next = vi.fn().mockResolvedValue({
    request,
    pathname,
    context: {},
    response: new Response('<html></html>'),
  });

  const result = await middleware.options.server?.({
    request,
    pathname,
    context: undefined,
    handlerType: 'router',
    next,
  });

  const response = result instanceof Response ? result : result?.response;
  return { headers: response?.headers, nonce: next.mock.calls[0]?.[0].context.nonce };
}

describe('@vp/security-headers: request middleware', () => {
  it('allows only scripts carrying the nonce it handed the render, and what they load', async () => {
    const { headers, nonce } = await renderedHeaders();

    expect(nonce).toEqual(expect.any(String));
    expect(headers?.get('Content-Security-Policy')).toBe(
      `script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`
    );
  });

  it.each([
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['X-Frame-Options', 'DENY'],
  ])('answers with %s: %s', async (name, value) => {
    const { headers } = await renderedHeaders();

    expect(headers?.get(name)).toBe(value);
  });

  describe('with an embeddable prefix', () => {
    const middleware = createSecurityHeadersMiddleware({ embeddablePrefix: '/embed/' });

    it('lets any site frame a path under it, and keeps the rest of the policy', async () => {
      const { headers, nonce } = await renderedHeaders('/embed/abc', middleware);

      expect(headers?.get('Content-Security-Policy')).toBe(
        `script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'self'; frame-ancestors *; form-action 'self'`
      );
      expect(headers?.has('X-Frame-Options')).toBe(false);
      expect(headers?.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it.each(['/', '/watch/abc', '/embedded'])('lets no site frame %s', async (path) => {
      const { headers } = await renderedHeaders(path, middleware);

      expect(headers?.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
      expect(headers?.get('X-Frame-Options')).toBe('DENY');
    });
  });
});
