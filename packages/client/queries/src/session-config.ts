import { getGlobalStartContext } from '@tanstack/react-start';
import { tryCatch, unwrapOr } from '@vp/result';

/** Exchanges the token the API refused for a fresh one, or says there is none to be had. */
export type RefreshSession = (refused: string) => Promise<string | undefined>;

export type SessionConfig = {
  /** Where the app's server reaches the API: the proxy and the server render call it there. */
  apiBaseUrl: string;
  /** The parent domain both apps share, so one sign-in holds on both; unset locally. */
  cookieDomain?: string;
  refresh?: RefreshSession;
};

// Start types the request context from the app's registered middleware, which a package never sees.
type SessionContext = { sessionCookieDomain?: string };

/** The cookie domain `sessionMiddleware` put in a server function's request context; none in a spec. */
export function requestCookieDomain(): string | undefined {
  const context = unwrapOr(
    tryCatch(
      (): SessionContext | undefined => getGlobalStartContext(),
      (cause) => cause
    ),
    undefined
  );
  return context?.sessionCookieDomain;
}
