import type { QueryClient } from '@tanstack/react-query';
import type { Account } from '@vp/api-contracts';
import { IntlProvider } from '@vp/intl-react';
import type { UserContext } from '@vp/permissions';
import { PermissionsProvider } from '@vp/permissions-react';
import {
  AUTH_TOKEN_LOCAL_STORAGE_KEY,
  ApiProvider,
  AuthProvider,
  accountQueryOptions,
  createQueryClient,
} from '@vp/queries';
import { type ThemePreference, ThemeProvider, TooltipProvider } from '@vp/ui';
import { account, api, stubBrowser } from '@vp/web-testing';
import type { ComponentType, PropsWithChildren, ReactElement } from 'react';

import { SidebarProvider } from '../modules/shared/providers/sidebar-provider';

/** What the root route mounts around every page, in a fixed locale and zone. */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <IntlProvider locale="en" timeZone="UTC">
      <ApiProvider api={api}>
        <AuthProvider>{children}</AuthProvider>
      </ApiProvider>
    </IntlProvider>
  );
}

/** The app's providers with the permissions of `viewer` in place of the signed-in account's. */
export function asViewer(viewer: UserContext | null): ComponentType<PropsWithChildren> {
  return ({ children }) => (
    <AppProviders>
      <PermissionsProvider userContext={viewer}>{children}</PermissionsProvider>
    </AppProviders>
  );
}

/** Adds the sidebar and theme providers the layout reads, the theme as the server read it. */
export function inChrome(page: ReactElement, theme: ThemePreference = 'dark'): ReactElement {
  return (
    <SidebarProvider>
      <ThemeProvider preference={theme}>
        <TooltipProvider>{page}</TooltipProvider>
      </ThemeProvider>
    </SidebarProvider>
  );
}

/** The browser of a viewer with `token` stored, or a guest's without one. */
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
