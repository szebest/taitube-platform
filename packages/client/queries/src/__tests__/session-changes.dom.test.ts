import {
  Outlet,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
} from '@tanstack/react-router';
import { account, api } from '@vp/web-testing';

import { type AppRouterContext, createAppRouter } from '../app-router';
import { GUEST, SESSION_KEY, type Session } from '../session';
import { endSession, settleSession } from '../session-changes';

const rootRoute = createRootRouteWithContext<AppRouterContext>()({ component: Outlet });
const routeTree = rootRoute.addChildren(
  ['/subscriptions', '/login'].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null })
  )
);

async function routerAt(url: string, session?: Session) {
  const router = createAppRouter(
    {
      routeTree,
      apiBaseUrl: 'http://localhost:3000',
      pending: () => null,
      error: () => null,
      notFound: () => null,
    },
    { api, history: createMemoryHistory({ initialEntries: [url] }) }
  );
  const { queryClient } = router.options.context;
  if (session) queryClient.setQueryData(SESSION_KEY, session);
  queryClient.setQueryData(['videos', 'mine'], ['the last viewer']);
  await router.load();
  return { router, queryClient };
}

describe('@vp/queries: session changes', () => {
  it('sends a signed-in viewer whose session ended to /login, and back here after, as a guest', async () => {
    const { router, queryClient } = await routerAt('/subscriptions?tab=new', {
      status: 'signed-in',
      account: account(),
    });

    endSession(router);
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/login'));

    expect(router.state.location.search).toEqual({ redirect: '/subscriptions?tab=new' });
    expect(queryClient.getQueryData(SESSION_KEY)).toEqual(GUEST);
    expect(queryClient.getQueryData(['videos', 'mine'])).toBeUndefined();
  });

  it("leaves a guest's 401 a refusal, where it happened", async () => {
    const { router, queryClient } = await routerAt('/subscriptions', GUEST);

    endSession(router);

    expect(router.state.location.pathname).toBe('/subscriptions');
    expect(queryClient.getQueryData(['videos', 'mine'])).toEqual(['the last viewer']);
  });

  it("drops the last viewer's cache and loads the routes again after a sign-in or a sign-out", async () => {
    const { router, queryClient } = await routerAt('/subscriptions', GUEST);
    const invalidate = vi.spyOn(router, 'invalidate');

    await settleSession(router);

    expect(queryClient.getQueryData(['videos', 'mine'])).toBeUndefined();
    expect(invalidate).toHaveBeenCalledOnce();
  });
});
