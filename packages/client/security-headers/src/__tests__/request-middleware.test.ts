import { clientAppRequestMiddleware } from '../request-middleware';
import { securityHeadersMiddleware } from '../security-headers';

type HandlerType = 'router' | 'serverFn';

const [serverFunctionCsrfMiddleware, headersMiddleware] = clientAppRequestMiddleware;

async function answerOf(handlerType: HandlerType, headers: Record<string, string>) {
  const request = new Request('http://localhost:5173/_serverFn/x', { method: 'POST', headers });
  const next = vi
    .fn()
    .mockResolvedValue({ request, pathname: '/_serverFn/x', context: {}, response: new Response('ok') });

  const result = await serverFunctionCsrfMiddleware?.options.server?.({
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
  it('refuses a cross-site call to a server function before anything renders', async () => {
    const { status, rendered } = await answerOf('serverFn', { 'sec-fetch-site': 'cross-site' });

    expect(status).toBe(403);
    expect(rendered).toBe(false);
  });

  it.each([
    { call: 'a same-origin call to a server function', handlerType: 'serverFn' as const },
    { call: 'a cross-site page request', handlerType: 'router' as const },
  ])('lets $call through', async ({ handlerType }) => {
    const { rendered } = await answerOf(handlerType, { 'sec-fetch-site': 'same-origin' });

    expect(rendered).toBe(true);
  });

  it('runs the CSRF check before the headers middleware, so a refused call carries no nonce', () => {
    expect(clientAppRequestMiddleware).toHaveLength(2);
    expect(headersMiddleware).toBe(securityHeadersMiddleware);
  });
});
