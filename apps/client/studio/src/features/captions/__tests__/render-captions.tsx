import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Account } from '@vp/api-contracts';
import { VIDEO_ID, account, apiServer } from '@vp/web-testing';
import type { HttpHandler } from 'msw/http';
import type { PropsWithChildren, ReactNode } from 'react';
import { signedIn } from '#app/__tests__/providers';

/** `ui` as the creator `who` sees it, over a query client that does not retry, with the API answering `handlers`. */
export function renderCaptions(
  ui: ReactNode,
  handlers: HttpHandler[] = [],
  who: Account = account()
) {
  apiServer.use(...handlers);
  const Providers = signedIn(who);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    queryClient,
    videoId: VIDEO_ID,
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
