import { trackRouter } from '@kit/web-testing';
import type { QueryClient } from '@tanstack/react-query';
import {
  type AnyRouter,
  RouterProvider,
  type RouterHistory,
  createMemoryHistory,
} from '@tanstack/react-router';
import { type RenderResult, type queries, render, waitFor } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import type { HttpHandler } from 'msw/http';
import { apiServer } from './api-server';

/** An app's router: TanStack Router with the `QueryClient` its loaders fill in router context. */
export type QueryRouter = AnyRouter & { options: { context: { queryClient: QueryClient } } };

const FIRST_LOAD_TIMEOUT_MS = 5_000;

type RouteOptions = {
  handlers?: HttpHandler[];
  /** Whether to return only once the first render's queries have answered; off for a spec that holds one on purpose. */
  awaitQueries?: boolean;
};

export type RenderedRoute<TRouter> = RenderResult<typeof queries, Document> & {
  router: TRouter;
  queryClient: QueryClient;
  user: UserEvent;
};

/**
 * Opens `url` in the app's real route tree, built by its own `getRouter` over memory history, and
 * renders the document a browser would show, with queries that never retry, and returns once the
 * router the mounted tree started has settled and the queries the first render fired have answered,
 * so no transition outlives the test and the first load never lands inside a test's own `findBy`.
 */
export async function renderRoute<TRouter extends QueryRouter>(
  getRouter: (options: { history: RouterHistory }) => TRouter,
  url: string,
  { handlers = [], awaitQueries = true }: RouteOptions = {}
): Promise<RenderedRoute<TRouter>> {
  apiServer.use(...handlers);
  const router = getRouter({ history: createMemoryHistory({ initialEntries: [url] }) });
  trackRouter(router);
  const { queryClient } = router.options.context;
  const { queries } = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({ queries: { ...queries, retry: false } });
  await router.load();
  const user = userEvent.setup();
  // The root route renders the whole document, <html> included, which no <div> may hold.
  const rendered = render(<RouterProvider router={router} />, { container: document });
  await waitFor(
    () => {
      expect(router.state.isLoading).toBe(false);
      if (awaitQueries) expect(queryClient.isFetching()).toBe(0);
    },
    { timeout: FIRST_LOAD_TIMEOUT_MS }
  );
  return { ...rendered, router, queryClient, user };
}
