import { clientAppRequestMiddleware } from '../request-middleware';
import { securityHeadersMiddleware } from '../security-headers';

type HandlerType = 'router' | 'serverFn';

const [crossSiteWriteMiddleware, headersMiddleware] = clientAppRequestMiddleware;

async function answerOf(
  handlerType: HandlerType,
  headers: Record<string, string>,
  method = 'POST'
) {
  const request = new Request('http://localhost:5173/_serverFn/x', { method, headers });
  const next = vi.fn().mockResolvedValue({
    request,
    pathname: '/_serverFn/x',
    context: {},
    response: new Response('ok'),
  });

  const result = await crossSiteWriteMiddleware?.options.server?.({
    request,
    pathname: '/_serverFn/x',
    context: undefined,
    handlerType,
    next,
  });

  const response = result instanceof Response ? result : result?.response;
  return { status: response?.status, rendered: next.mock.calls.length > 0 };
}

describe('@vp/security-headers: client app request middleware', () => {
  it.each([
    { call: 'a server function', handlerType: 'serverFn' as const, method: 'GET' },
    { call: 'a write through the /api proxy', handlerType: 'router' as const, method: 'POST' },
  ])('refuses a cross-site call to $call before anything runs', async ({ handlerType, method }) => {
    const { status, rendered } = await answerOf(
      handlerType,
      { 'sec-fetch-site': 'cross-site' },
      method
    );

    expect(status).toBe(403);
    expect(rendered).toBe(false);
  });

  it.each([
    {
      call: 'a same-origin call to a server function',
      handlerType: 'serverFn' as const,
      site: 'same-origin',
      method: 'POST',
    },
    {
      call: 'a cross-site page request',
      handlerType: 'router' as const,
      site: 'cross-site',
      method: 'GET',
    },
  ])('lets $call through', async ({ handlerType, site, method }) => {
    const { rendered } = await answerOf(handlerType, { 'sec-fetch-site': site }, method);

    expect(rendered).toBe(true);
  });

  it('runs the CSRF check before the headers middleware, so a refused call carries no nonce', () => {
    expect(clientAppRequestMiddleware).toHaveLength(2);
    expect(headersMiddleware).toBe(securityHeadersMiddleware);
  });
});
