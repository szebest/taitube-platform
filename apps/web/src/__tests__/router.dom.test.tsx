import { Link, createMemoryHistory } from '@tanstack/react-router';

import { RouteError, RouteNotFound, RoutePending } from '#app/components/route-fallbacks';
import { guestSession } from '#app/integrations/auth/session';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { getRouter } from '#app/router';
import { CHANNEL_ID, VIDEO_ID } from './fixtures';
import { loaderApi } from './loader-api';
import { apiServer } from './msw/api-server';

async function resolve(path: string) {
  const router = getRouter({ history: createMemoryHistory({ initialEntries: [path] }) });
  await router.load();
  return router;
}

describe('apps/web: router', () => {
  it.each([
    { path: '/', routeId: '/' },
    { path: '/trending', routeId: '/trending' },
    { path: '/subscriptions', routeId: '/_authed/subscriptions/' },
    { path: '/subscriptions/videos', routeId: '/_authed/subscriptions/videos' },
    { path: `/channel/${CHANNEL_ID}`, routeId: '/channel/$channelId' },
    { path: `/watch/${VIDEO_ID}`, routeId: '/watch/$videoId' },
    { path: '/upload', routeId: '/_authed/upload/' },
    { path: `/upload/edit/${VIDEO_ID}`, routeId: '/_authed/upload/edit/$videoId' },
  ])('resolves $path to $routeId', async ({ path, routeId }) => {
    apiServer.use(...loaderApi());

    const router = await resolve(path);

    expect(router.state.matches.at(-1)?.routeId).toBe(routeId);
    expect(router.state.matches.at(-1)?.status).toBe('success');
  });

  it.each([
    { path: '/watch/not-a-video' },
    { path: '/channel/not-a-channel' },
    { path: '/upload/edit/not-a-video' },
  ])('answers $path with not-found and no API call', async ({ path }) => {
    const answered: string[] = [];
    apiServer.use(...loaderApi(answered));

    const router = await resolve(path);

    expect(router.state.matches.some((match) => match.status === 'notFound')).toBe(true);
    expect(answered).toEqual([]);
  });

  it('loads the video once when the watch page and the edit page both need it', async () => {
    const answered: string[] = [];
    apiServer.use(...loaderApi(answered));
    const router = await resolve(`/watch/${VIDEO_ID}`);

    await router.navigate({ to: '/upload/edit/$videoId', params: { videoId: VIDEO_ID } });

    expect(router.state.matches.at(-1)?.routeId).toBe('/_authed/upload/edit/$videoId');
    expect(answered).toEqual([`/v1/videos/${VIDEO_ID}`]);
  });

  it('serves a feed page already visited from the cache when the viewer comes back to it', async () => {
    const answered: string[] = [];
    apiServer.use(...loaderApi(answered));
    const router = await resolve('/');

    await router.navigate({ to: '/trending' });
    await router.navigate({ to: '/' });

    expect(answered.filter((path) => path === '/v1/feed')).toHaveLength(2);
    expect(answered.filter((path) => path === '/v1/categories')).toHaveLength(1);
  });

  it('builds a new query cache for every router, so no two requests share one', () => {
    expect(getRouter().options.context.queryClient).not.toBe(
      getRouter().options.context.queryClient
    );
  });

  it('renders for a guest', () => {
    expect(getRouter().options.context.auth).toEqual({ status: 'guest' });
  });

  it('puts the query cache and session it is handed in context', () => {
    const queryClient = createQueryClient();
    const auth = guestSession();

    const { context } = getRouter({ queryClient, auth }).options;

    expect(context.queryClient).toBe(queryClient);
    expect(context.auth).toBe(auth);
  });

  it("stamps the request's CSP nonce on the scripts it renders", () => {
    expect(getRouter({ nonce: 'n0nce' }).options.ssr?.nonce).toBe('n0nce');
  });

  it('waits before showing a pending page, and then shows it long enough not to flash', () => {
    const { options } = getRouter();

    expect(options.defaultPendingMs).toBeGreaterThan(0);
    expect(options.defaultPendingMinMs).toBeGreaterThan(0);
  });

  it('registers the pending, error and not-found pages every route falls back to', () => {
    const { options } = getRouter();

    expect(options.defaultPendingComponent).toBe(RoutePending);
    expect(options.defaultErrorComponent).toBe(RouteError);
    expect(options.defaultNotFoundComponent).toBe(RouteNotFound);
  });

  it('types links against the route tree', () => {
    const links = [
      // @ts-expect-error no route has this path
      <Link key="unknown" to="/no-such-route" />,
      // @ts-expect-error the watch route cannot be linked without its videoId
      <Link key="unbound" to="/watch/$videoId" />,
      <Link key="bound" to="/watch/$videoId" params={{ videoId: VIDEO_ID }} />,
    ];

    expect(links).toHaveLength(3);
  });

  it('preloads a route when the pointer shows intent', () => {
    expect(getRouter().options.defaultPreload).toBe('intent');
  });
});
