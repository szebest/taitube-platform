import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { HttpHandler } from 'msw';

import { type Session, guestSession } from '#app/integrations/auth/session';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { getRouter } from '#app/router';
import { apiServer } from './msw/api-server';

type RouteOptions = {
  handlers?: HttpHandler[];
  auth?: Session;
};

export async function renderRoute(
  url: string,
  { handlers = [], auth = guestSession() }: RouteOptions = {}
) {
  apiServer.use(...handlers);
  const queryClient = createQueryClient();
  const { queries } = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({ queries: { ...queries, retry: false } });
  const router = getRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    queryClient,
    auth,
  });
  await router.load();
  const user = userEvent.setup();
  // The root route renders the whole document, <html> included, which no <div> may hold.
  const rendered = render(<RouterProvider router={router} />, { container: document });
  return { ...rendered, router, queryClient, user };
}
