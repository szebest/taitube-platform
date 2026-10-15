import { securityHeadersMiddleware } from '../security-headers';

async function renderedHeaders() {
  const request = new Request('http://localhost:5173/');
  const next = vi.fn().mockResolvedValue({
    request,
    pathname: '/',
    context: {},
    response: new Response('<html></html>'),
  });

  const result = await securityHeadersMiddleware.options.server?.({
    request,
    pathname: '/',
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
  ])('answers with %s: %s', async (name, value) => {
    const { headers } = await renderedHeaders();

    expect(headers?.get(name)).toBe(value);
  });
});
