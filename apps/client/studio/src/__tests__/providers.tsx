import type { QueryClient } from '@tanstack/react-query';
import type { Account } from '@vp/api-contracts';
import { IntlProvider } from '@vp/intl-react';
import {
  AUTH_TOKEN_LOCAL_STORAGE_KEY,
  ApiProvider,
  AuthProvider,
  accountQueryOptions,
  createQueryClient,
} from '@vp/queries';
import { ThemeProvider, ToastProvider, TooltipProvider, createToaster } from '@vp/ui';
import { account, api, stubBrowser } from '@vp/web-testing';
import type { PropsWithChildren } from 'react';

/** What the root route mounts around every page, in a fixed locale and zone and the dark theme. */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <IntlProvider locale="en" timeZone="UTC">
      <ApiProvider api={api}>
        <AuthProvider>
          <ThemeProvider preference="dark">
            <TooltipProvider>
              <ToastProvider toaster={createToaster()} closeLabel="Dismiss">
                {children}
              </ToastProvider>
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </ApiProvider>
    </IntlProvider>
  );
}

/** The browser of a creator with `token` stored, or a guest's without one. */
export function stubSession(token?: string): Map<string, string> {
  return stubBrowser(token ? { [AUTH_TOKEN_LOCAL_STORAGE_KEY]: token } : {});
}

/** Stores a token and caches `signedIn` as the account it resolves to, so no request is made for it. */
export function signIn(
  signedIn: Account = account(),
  queryClient: QueryClient = createQueryClient()
): QueryClient {
  stubSession('signed-in');
  queryClient.setQueryData(accountQueryOptions(api).queryKey, signedIn);
  return queryClient;
}
