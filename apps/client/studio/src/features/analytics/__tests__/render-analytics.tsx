import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { signedIn } from '#app/__tests__/providers';

const Providers = signedIn();

/** `ui` inside the studio's providers, a router and a query client that does not retry. */
export async function renderAnalytics(ui: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <Providers>{ui}</Providers>
        </QueryClientProvider>
      ),
    }),
    history: createMemoryHistory(),
  });
  await router.load();
  return { ...render(<RouterProvider router={router} />), user: userEvent.setup() };
}
