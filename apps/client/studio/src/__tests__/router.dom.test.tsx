import { createMemoryHistory } from '@tanstack/react-router';
import { requestHandler } from '@tanstack/react-start/server';
import { RouteError, RouteNotFound } from '@vp/queries';
import { getVideo } from '@vp/api-contracts';
import { VIDEO_ID, apiServer, video } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { mockEndpoint } from '@vp/web-testing';
import { signInBrowser } from '#app/__tests__/providers';
import { RoutePending } from '#app/features/errors/components/route-fallbacks';
import { getRouter } from '#app/router';

/** Loads `path` for a signed-in creator, recording every video the loaders asked for. */
async function resolve(path: string) {
  const answered: string[] = [];
  apiServer.use(
    signInBrowser(),
    mockEndpoint(getVideo, ({ request }) => {
      answered.push(new URL(request.url).pathname);
      return HttpResponse.json(video());
    })
  );
  const router = getRouter({ history: createMemoryHistory({ initialEntries: [path] }) });
  const answer = requestHandler(async () => {
    await router.load();
    return new Response();
  });
  await answer(new Request(`http://localhost:5174${path}`), {});
  return { router, answered };
}

describe('apps/client/studio: router', () => {
  it.each([
    { path: '/upload', routeId: '/_authed/upload/' },
    { path: `/upload/edit/${VIDEO_ID}`, routeId: '/_authed/upload/edit/$videoId' },
  ])('resolves $path to $routeId', async ({ path, routeId }) => {
    const { router } = await resolve(path);

    expect(router.state.matches.at(-1)?.routeId).toBe(routeId);
    expect(router.state.matches.at(-1)?.status).toBe('success');
  });

  it('answers /upload/edit/not-a-video with not-found and no API call', async () => {
    const { router, answered } = await resolve('/upload/edit/not-a-video');

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
