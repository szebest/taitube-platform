import { type Account, getAccount } from '@vp/api-contracts';
import { IntlProvider } from '@vp/intl-react';
import { ApiProvider, GUEST, SESSION_COOKIE, type Session, SessionProvider } from '@vp/queries';
import { DEV_TOKEN_URL } from '@vp/queries/dev-personas';
import { ThemeProvider, ToastProvider, TooltipProvider, createToaster } from '@vp/ui';
import { account, api, mockEndpoint } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';
import type { ComponentType, PropsWithChildren } from 'react';

function providersFor(session: Session): ComponentType<PropsWithChildren> {
  return ({ children }) => (
    <IntlProvider locale="en" timeZone="UTC">
      <ApiProvider api={api}>
        <SessionProvider session={session}>
          <ThemeProvider preference="dark">
            <TooltipProvider>
              <ToastProvider toaster={createToaster()} closeLabel="Dismiss">
                {children}
              </ToastProvider>
            </TooltipProvider>
          </ThemeProvider>
        </SessionProvider>
      </ApiProvider>
    </IntlProvider>
  );
}

/** What the root route mounts around every page for a guest, in a fixed locale and zone and the dark theme. */
export const AppProviders = providersFor(GUEST);

/** The same, for a creator signed in. */
export function signedIn(creator: Account = account()): ComponentType<PropsWithChildren> {
  return providersFor({ status: 'signed-in', account: creator });
}

/** The session cookie of a signed-in browser, as a request carries it. */
export const SESSION = `${SESSION_COOKIE}=signed-in`;

/** The API's answer for the account the session cookie reaches. */
export function accountOf(creator: Account = account()) {
  return mockEndpoint(getAccount, () => HttpResponse.json(creator));
}

/** Signs this jsdom browser in as `creator`: the session cookie, and the API naming them. */
export function signInBrowser(creator: Account = account()) {
  // biome-ignore lint/suspicious/noDocumentCookie: jsdom's jar is where the session cookie lives.
  document.cookie = `${SESSION}; path=/`;
  return accountOf(creator);
}

/** `dev-token serve` on this machine, minting the token of whichever persona is asked for. */
export function devTokenServe() {
  return http.get(`${DEV_TOKEN_URL}/token`, ({ request }) =>
    HttpResponse.json({ token: `token-of-${new URL(request.url).searchParams.get('persona')}` })
  );
}
