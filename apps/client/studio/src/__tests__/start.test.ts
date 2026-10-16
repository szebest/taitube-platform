import { requestHandler } from '@tanstack/react-start/server';
import { getVideo } from '@vp/api-contracts';
import { clientAppRequestMiddleware } from '@vp/security-headers';
import { VIDEO_ID, apiServer, mockEndpoint, video } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { startInstance } from '../start';

async function requestMiddleware() {
  return (await startInstance.getOptions()).requestMiddleware ?? [];
}

describe('apps/client/studio: start', () => {
  it('runs the CSRF check and the security headers before anything else', async () => {
    expect((await requestMiddleware()).slice(0, 2)).toEqual(clientAppRequestMiddleware);
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
