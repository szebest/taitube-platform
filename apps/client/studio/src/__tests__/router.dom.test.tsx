import { createMemoryHistory } from '@tanstack/react-router';
import { requestHandler } from '@tanstack/react-start/server';
import { getVideo } from '@vp/api-contracts';
import { VIDEO_ID, apiServer, video } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { mockEndpoint } from '@vp/web-testing';
import { RouteError, RouteNotFound, RoutePending } from '#app/components/route-fallbacks';
import { getRouter } from '#app/router';

async function resolve(path: string) {
  const router = getRouter({ history: createMemoryHistory({ initialEntries: [path] }) });
  const answer = requestHandler(async () => {
    await router.load();
    return new Response();
  });
  await answer(new Request(`http://localhost:5174${path}`), {});
  return router;
}

describe('apps/client/studio: router', () => {
  it.each([
    { path: '/upload', routeId: '/_authed/upload/' },
    { path: `/upload/edit/${VIDEO_ID}`, routeId: '/_authed/upload/edit/$videoId' },
  ])('resolves $path to $routeId', async ({ path, routeId }) => {
    const router = await resolve(path);

    expect(router.state.matches.at(-1)?.routeId).toBe(routeId);
    expect(router.state.matches.at(-1)?.status).toBe('success');
  });

  it('answers /upload/edit/not-a-video with not-found and no API call', async () => {
    const answered: string[] = [];
    apiServer.use(
      mockEndpoint(getVideo, ({ request }) => {
        answered.push(new URL(request.url).pathname);
        return HttpResponse.json(video());
      })
    );

    const router = await resolve('/upload/edit/not-a-video');

    expect(router.state.matches.map(({ status }) => status)).toContain('notFound');
    expect(answered).toEqual([]);
  });

  it("registers this app's pending, error and not-found pages", () => {
    const { options } = getRouter();

    expect(options.defaultPendingComponent).toBe(RoutePending);
    expect(options.defaultErrorComponent).toBe(RouteError);
    expect(options.defaultNotFoundComponent).toBe(RouteNotFound);
  });
});
