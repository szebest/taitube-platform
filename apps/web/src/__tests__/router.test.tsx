import { Link, createMemoryHistory } from '@tanstack/react-router';
import { RouteError, RouteNotFound, RoutePending } from '../components/route-fallbacks';
import { PENDING_DELAY_MS, PENDING_MIN_MS, getRouter } from '../router';
import { jsonResponse, recordRequests } from './api-store';
import { CHANNEL_ID, VIDEO_ID, video } from './fixtures';

async function resolve(path: string) {
  const router = getRouter(createMemoryHistory({ initialEntries: [path] }));
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
    recordRequests(() => jsonResponse(video()));

    const router = await resolve(path);

    expect(router.state.matches.at(-1)?.routeId).toBe(routeId);
    expect(router.state.matches.at(-1)?.status).toBe('success');
  });

  it.each([
    { path: '/watch/not-a-video' },
    { path: '/channel/not-a-channel' },
    { path: '/upload/edit/not-a-video' },
  ])('answers $path with not-found and no API call', async ({ path }) => {
    const sent = recordRequests();

    const router = await resolve(path);

    expect(router.state.matches.some((match) => match.status === 'notFound')).toBe(true);
    expect(sent).toEqual([]);
  });

  it('builds a new query cache for every router, so no two requests share one', () => {
    expect(getRouter().options.context.queryClient).not.toBe(
      getRouter().options.context.queryClient
    );
  });

  it('renders for a guest', () => {
    expect(getRouter().options.context.auth).toEqual({ status: 'guest' });
  });

  it('waits before showing a pending page, and then shows it long enough not to flash', () => {
    const { options } = getRouter();

    expect(options.defaultPendingMs).toBe(PENDING_DELAY_MS);
    expect(options.defaultPendingMinMs).toBe(PENDING_MIN_MS);
    expect(PENDING_DELAY_MS).toBeGreaterThan(0);
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
