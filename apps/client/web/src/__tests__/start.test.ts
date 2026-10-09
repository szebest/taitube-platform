import { startInstance } from '../start';

async function securityHeadersMiddleware() {
  const { requestMiddleware = [] } = await startInstance.getOptions();
  return requestMiddleware.at(-1)?.options.server;
}

describe('apps/client/web: start', () => {
  it('answers every page with a policy naming the nonce it handed the render', async () => {
    const request = new Request('http://localhost:5173/');
    const next = vi.fn().mockResolvedValue({
      request,
      pathname: '/',
      context: {},
      response: new Response('<html></html>'),
    });
    const server = await securityHeadersMiddleware();

    const result = await server?.({
      request,
      pathname: '/',
      context: undefined,
      handlerType: 'router',
      next,
    });

    const nonce = next.mock.calls[0]?.[0].context.nonce;
    const response = result instanceof Response ? result : result?.response;
    expect(nonce).toEqual(expect.any(String));
    expect(response?.headers.get('Content-Security-Policy')).toContain(
      `script-src 'nonce-${nonce}'`
    );
  });
});
