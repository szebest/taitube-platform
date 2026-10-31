import { requestHandler } from '@tanstack/react-start/server';
import { getVideo } from '@vp/api-contracts';
import { apiServer, mockEndpoint, VIDEO_ID, video } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { startInstance } from '../start';

async function requestMiddleware() {
  return (await startInstance.getOptions()).requestMiddleware ?? [];
}

describe('apps/client/web: start', () => {
  it.each([
    { path: '/watch/abc', framedBy: "'none'", frameOptions: 'DENY' },
    { path: '/embed/abc', framedBy: '*', frameOptions: null },
  ])('lets $path be framed by $framedBy', async ({ path, framedBy, frameOptions }) => {
    const headersMiddleware = (await requestMiddleware())[1];
    const request = new Request(`http://localhost:5173${path}`);

    const result = await headersMiddleware?.options.server?.({
      request,
      pathname: path,
      context: undefined,
      handlerType: 'router',
      next: vi.fn().mockResolvedValue({
        request,
        pathname: path,
        context: {},
        response: new Response('ok'),
      }),
    });

    const headers = result instanceof Response ? result.headers : result?.response.headers;
    expect(headers?.get('Content-Security-Policy')).toContain(`frame-ancestors ${framedBy}`);
    expect(headers?.get('X-Frame-Options')).toBe(frameOptions);
  });

  it("answers the browser's /api calls on this origin from the API", async () => {
    apiServer.use(
      mockEndpoint(getVideo, () => HttpResponse.json(video({ title: 'Through the proxy' })))
    );
    const proxy = (await requestMiddleware()).at(-1);
    const request = new Request(`http://localhost:5174/api/v1/videos/${VIDEO_ID}`);

    const answer = await requestHandler(async () => {
      const result = await proxy?.options.server?.({
        request,
        pathname: new URL(request.url).pathname,
        context: undefined,
        handlerType: 'router',
        next: vi.fn(),
      });
      return result instanceof Response ? result : new Response(null, { status: 500 });
    })(request, {});

    expect(await answer.json()).toEqual(video({ title: 'Through the proxy' }));
  });
});
