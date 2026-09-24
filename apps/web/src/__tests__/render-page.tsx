import type { Account } from '@vp/api-contracts';
import type { UserContext } from '@vp/permissions';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { accountApi } from '../modules/shared/api/account-api';
import { AuthProvider } from '../modules/shared/providers/auth-provider';
import { PermissionsProvider } from '../modules/shared/providers/permissions-provider';
import { type ApiStore, createApiStore, seed } from './api-store';
import { stubBrowser } from './browser';

export type PageOptions = {
  store?: ApiStore;
  url?: string;
  route?: string;
  viewer?: UserContext | null;
};

/**
 * Renders inside the providers `App` mounts, over a store a spec can seed. A `viewer` overrides
 * the permissions the signed-in account would give.
 */
export function renderPage(
  page: ReactElement,
  { store = createApiStore(), url = '/', route = '*', viewer }: PageOptions = {}
): string {
  return renderToStaticMarkup(
    <Provider store={store}>
      <AuthProvider>
        <PermissionsProvider userContext={viewer}>
          <MemoryRouter initialEntries={[url]}>
            <Routes>
              <Route path={route} element={page} />
            </Routes>
          </MemoryRouter>
        </PermissionsProvider>
      </AuthProvider>
    </Provider>
  );
}

export async function signIn(store: ApiStore, signedIn: Account): Promise<void> {
  stubBrowser({ token: 'signed-in' });
  await seed(store, (target) => target.dispatch(accountApi.endpoints.account.initiate()), signedIn);
}
