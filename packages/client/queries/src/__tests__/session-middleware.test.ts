import { requestHandler } from '@tanstack/react-start/server';
import { apiServer } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';

import { sessionMiddleware } from '../session-middleware';

const API = 'http://api.internal:3000';

async function answer(pathname: string) {
  const proxied = vi.fn(() => HttpResponse.json({}));
  apiServer.use(http.all(`${API}/*`, proxied));
  const next = vi.fn().mockResolvedValue({ response: new Response('page') });
  const request = new Request(`http://localhost:5173${pathname}`);
  const middleware = sessionMiddleware({ apiBaseUrl: API, cookieDomain: 'taitube.example' });

  await requestHandler(async () => {
    await middleware.options.server?.({
      request,
      pathname,
      context: undefined,
      handlerType: 'router',
      next,
    });
    return new Response(null);
  })(request, {});

  return { proxied: proxied.mock.calls.length > 0, next };
}

describe('@vp/queries: session middleware', () => {
  it.each(['/api/v1/videos', '/api'])('answers %s from the API', async (pathname) => {
    const { proxied, next } = await answer(pathname);

    expect(proxied).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it.each(['/apiary', '/watch/abc', '/_serverFn/x'])(
    "renders %s, handing it the session cookie's domain",
    async (pathname) => {
      const { proxied, next } = await answer(pathname);

      expect(proxied).toBe(false);
      expect(next).toHaveBeenCalledWith({ context: { sessionCookieDomain: 'taitube.example' } });
    }
  );
});
