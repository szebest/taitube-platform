import { tryCatch, unwrapOr } from '@kit/result';
import { getGlobalStartContext } from '@tanstack/react-start';

export { SESSION_COOKIE } from '@vp/api-contracts';

/** How many accounts one browser holds when `ACCOUNTS_MAX` is unset: every slot. */
export const ACCOUNTS_MAX_DEFAULT = 10;

/** Exchanges the token the API refused for a fresh one, or says there is none to be had. */
export type RefreshSession = (refused: string) => Promise<string | undefined>;

export type SessionConfig = {
  /** Where the app's server reaches the API: the proxy and the server render call it there. */
  apiBaseUrl: string;
  /** The parent domain both apps share, so one sign-in holds on both; unset locally. */
  cookieDomain?: string;
  /** Where the app's server reaches `dev-token serve`, for a build that offers the demo personas; unset otherwise. */
  devTokenUrl?: string;
  /** How many accounts one browser may hold at once (`ACCOUNTS_MAX`). */
  accountsMax?: number;
  refresh?: RefreshSession;
};

/** What `sessionMiddleware` hands every server function of the request. */
export type RequestSession = {
  apiBaseUrl: string | undefined;
  cookieDomain: string | undefined;
  devTokenUrl: string | undefined;
  accountsMax: number;
};

// Start types the request context from the app's registered middleware, which a package never sees.
type SessionContext = { session?: Partial<RequestSession> };

function sessionContext(): SessionContext | undefined {
  return unwrapOr(
    tryCatch(
      (): SessionContext | undefined => getGlobalStartContext(),
      (cause) => cause
    ),
    undefined
  );
}

/** The settings `sessionMiddleware` put in a server function's request context; the defaults in a spec. */
export function requestSession(): RequestSession {
  const session = sessionContext()?.session;
  return {
    apiBaseUrl: session?.apiBaseUrl,
    cookieDomain: session?.cookieDomain,
    devTokenUrl: session?.devTokenUrl,
    accountsMax: session?.accountsMax ?? ACCOUNTS_MAX_DEFAULT,
  };
}
