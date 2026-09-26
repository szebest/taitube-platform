import type { QueryClient } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { HttpHandler } from 'msw';

import { type Session, guestSession } from '#app/integrations/auth/session';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { getRouter } from '#app/router';
import { apiServer } from './msw/api-server';

export type RouteOptions = {
  /** How the API answers while the route runs; a call none of them answers fails the test. */
  handlers?: HttpHandler[];
  auth?: Session;
};

function testQueryClient(): QueryClient {
  const queryClient = createQueryClient();
  const { queries } = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({ queries: { ...queries, retry: false } });
  return queryClient;
}

/**
 * Opens `url` in the app as a browser tab does: the real route tree and router over memory history,
 * a fresh query cache that never retries, and `auth` as the session in context.
 */
export async function renderRoute(
  url: string,
  { handlers = [], auth = guestSession() }: RouteOptions = {}
) {
  apiServer.use(...handlers);
  const queryClient = testQueryClient();
  const router = getRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    queryClient,
    auth,
  });
  await router.load();
  // The root route renders the whole document, <html> included, which no <div> may hold.
  const rendered = render(<RouterProvider router={router} />, { container: document });
  return { ...rendered, router, queryClient, user: userEvent.setup() };
}
