import type { QueryClient } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  type RouterHistory,
  RouterProvider,
} from '@tanstack/react-router';
import { type queries, type RenderResult, render } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import type { HttpHandler } from 'msw/http';

import { apiServer } from './api-server';

/** An app's router: TanStack Router with the `QueryClient` its loaders fill in router context. */
export type QueryRouter = AnyRouter & { options: { context: { queryClient: QueryClient } } };

type RouteOptions = {
  handlers?: HttpHandler[];
};

export type RenderedRoute<TRouter> = RenderResult<typeof queries, Document> & {
  router: TRouter;
  queryClient: QueryClient;
  user: UserEvent;
};

/**
 * Opens `url` in the app's real route tree, built by its own `getRouter` over memory history, and
 * renders the document a browser would show, with queries that never retry.
 */
export async function renderRoute<TRouter extends QueryRouter>(
  getRouter: (options: { history: RouterHistory }) => TRouter,
  url: string,
  { handlers = [] }: RouteOptions = {}
): Promise<RenderedRoute<TRouter>> {
  apiServer.use(...handlers);
  const router = getRouter({ history: createMemoryHistory({ initialEntries: [url] }) });
  const { queryClient } = router.options.context;
  const { queries } = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({ queries: { ...queries, retry: false } });
  await router.load();
  const user = userEvent.setup();
  // The root route renders the whole document, <html> included, which no <div> may hold.
  const rendered = render(<RouterProvider router={router} />, { container: document });
  return { ...rendered, router, queryClient, user };
}
