import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiServer } from '@vp/web-testing';
import type { HttpHandler } from 'msw/http';
import type { PropsWithChildren, ReactNode } from 'react';
import { signedIn } from '#app/__tests__/providers';

const Providers = signedIn();

/** `ui` in the studio's providers over a query client that does not retry, with the API answering `handlers`. */
export function renderLive(ui: ReactNode, handlers: HttpHandler[] = []) {
  apiServer.use(...handlers);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    queryClient,
    user: userEvent.setup(),
    ...render(ui, {
      wrapper: ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>
          <Providers>{children}</Providers>
        </QueryClientProvider>
      ),
    }),
  };
}
