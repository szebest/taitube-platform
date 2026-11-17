import { getGlobalStartContext } from '@tanstack/react-start';
import { tryCatch, unwrapOr } from '@vp/result';

export { SESSION_COOKIE } from '@vp/api-contracts';

/** Exchanges the token the API refused for a fresh one, or says there is none to be had. */
export type RefreshSession = (refused: string) => Promise<string | undefined>;

export type SessionConfig = {
  /** Where the app's server reaches the API: the proxy and the server render call it there. */
  apiBaseUrl: string;
  /** The parent domain both apps share, so one sign-in holds on both; unset locally. */
  cookieDomain?: string;
  /** Where the app's server reaches `dev-token serve`, for a build that offers the demo personas; unset otherwise. */
  devTokenUrl?: string;
  refresh?: RefreshSession;
};

// Start types the request context from the app's registered middleware, which a package never sees.
type SessionContext = { sessionCookieDomain?: string; devTokenUrl?: string };

function sessionContext(): SessionContext | undefined {
  return unwrapOr(
    tryCatch(
      (): SessionContext | undefined => getGlobalStartContext(),
      (cause) => cause
    ),
    undefined
  );
}

/** The cookie domain `sessionMiddleware` put in a server function's request context; none in a spec. */
export function requestCookieDomain(): string | undefined {
  return sessionContext()?.sessionCookieDomain;
}

/** The `dev-token serve` address `sessionMiddleware` put in a server function's request context. */
export function requestDevTokenUrl(): string | undefined {
  return sessionContext()?.devTokenUrl;
}
