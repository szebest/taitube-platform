import { getAccount } from '@vp/api-contracts';
import type { Account } from '@vp/api-contracts';
import { IntlProvider } from '@vp/intl-react';
import type { UserContext } from '@vp/permissions';
import { PermissionsProvider } from '@vp/permissions-react';
import { ApiProvider, GUEST, SESSION_COOKIE, type Session, SessionProvider } from '@vp/queries';
import { DEV_TOKEN_URL } from '@vp/queries/dev-personas';
import { TooltipProvider } from '@vp/ui';
import { account, api, mockEndpoint } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';
import type { ComponentType, PropsWithChildren } from 'react';

function providersFor(session: Session): ComponentType<PropsWithChildren> {
  return ({ children }) => (
    <IntlProvider locale="en" timeZone="UTC">
      <ApiProvider api={api}>
        <SessionProvider session={session}>
          <TooltipProvider>{children}</TooltipProvider>
        </SessionProvider>
      </ApiProvider>
    </IntlProvider>
  );
}

/** What the root route mounts around every page for a guest, in a fixed locale and zone. */
export const AppProviders = providersFor(GUEST);

/** The same, for `viewer` signed in. */
export function signedIn(viewer: Account = account()): ComponentType<PropsWithChildren> {
  return providersFor({ status: 'signed-in', account: viewer });
}

/** The app's providers with the permissions of `viewer` in place of the session's. */
export function asViewer(viewer: UserContext | null): ComponentType<PropsWithChildren> {
  return ({ children }) => (
    <AppProviders>
      <PermissionsProvider userContext={viewer}>{children}</PermissionsProvider>
    </AppProviders>
  );
}

/** The session cookie of a signed-in browser, as a request carries it. */
export const SESSION = `${SESSION_COOKIE}=signed-in`;

/** Signs this jsdom browser in as `viewer`: the session cookie, and the API naming them. */
export function signInBrowser(viewer: Account = account()) {
  // biome-ignore lint/suspicious/noDocumentCookie: jsdom's jar is where the session cookie lives.
  document.cookie = `${SESSION}; path=/`;
  return mockEndpoint(getAccount, () => HttpResponse.json(viewer));
}

/** `dev-token serve` on this machine, minting the token of whichever persona is asked for. */
export function devTokenServe() {
  return http.get(`${DEV_TOKEN_URL}/token`, ({ request }) =>
    HttpResponse.json({ token: `token-of-${new URL(request.url).searchParams.get('persona')}` })
  );
}
