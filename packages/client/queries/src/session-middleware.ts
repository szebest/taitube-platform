import { createMiddleware } from '@tanstack/react-start';
import { ACCOUNT_SLOT_HEADER, identityPath, parseSlot } from './account-slots';
import { API_PROXY_PATH } from './api-client';
import { proxyToApi } from './api-proxy';
import { type RequestIdentity, resolveRequestIdentity } from './request-identity';
import { ACCOUNTS_MAX_DEFAULT, type RequestSession, type SessionConfig } from './session-config';
import { migrateLegacySession } from './session-cookie';
import { singleFlightRefresh } from './single-flight-refresh';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);

const LOGIN_PATH = '/login';

const FOUND = 302;

function isProxied(pathname: string): boolean {
  return pathname === API_PROXY_PATH || pathname.startsWith(`${API_PROXY_PATH}/`);
}

/** A browser opening a page, not a script fetching a feed, a sitemap or a server function. */
function isPageRequest(request: Request): boolean {
  return (
    SAFE_METHODS.has(request.method) && (request.headers.get('accept') ?? '').includes('text/html')
  );
}

function found(location: string): Response {
  return new Response(null, { status: FOUND, headers: { location } });
}

/**
 * Where a page request belongs instead, if anywhere: a prefix naming a slot with no session signs
 * that slot in again, and a page with no prefix in a browser holding several accounts (or acting as
 * a channel other than the primary) moves under the default identity's prefix.
 */
function pageRedirect(request: Request, located: RequestIdentity): Response | undefined {
  const { search } = new URL(request.url);
  const { identity, prefixed, occupied, defaultIdentity, pathname } = located;
  if (pathname === LOGIN_PATH) return undefined;

  if (prefixed && !occupied.includes(identity.slot)) {
    const login = new URLSearchParams({
      slot: String(identity.slot),
      reason: 'expired',
      redirect: `${pathname}${search}`,
    });
    return found(`${LOGIN_PATH}?${login}`);
  }
  if (!prefixed && (occupied.length > 1 || defaultIdentity.channel !== undefined)) {
    return found(`${identityPath(defaultIdentity, pathname)}${search}`);
  }
  return undefined;
}

/**
 * The request middleware every client app's `src/start.ts` mounts after the CSRF check and the
 * security headers. It moves a browser signed in before slots onto slot 0, answers `/api/...` from
 * the API as the slot the call names, sends a page to the identity it belongs under, marks a
 * signed-in page private, and hands every other request, server functions included, the session
 * settings.
 */
export function sessionMiddleware({ refresh, ...config }: SessionConfig) {
  const proxied: SessionConfig = { ...config, refresh: refresh && singleFlightRefresh(refresh) };
  const session: RequestSession = {
    apiBaseUrl: config.apiBaseUrl,
    cookieDomain: config.cookieDomain,
    devTokenUrl: config.devTokenUrl,
    accountsMax: config.accountsMax ?? ACCOUNTS_MAX_DEFAULT,
  };

  return createMiddleware().server(async ({ request, next, handlerType }) => {
    migrateLegacySession(config.cookieDomain);
    const located = resolveRequestIdentity();

    if (isProxied(located.pathname)) {
      const named = parseSlot(request.headers.get(ACCOUNT_SLOT_HEADER));
      const slot = SAFE_METHODS.has(request.method) ? located.identity.slot : named;
      return proxyToApi(request, proxied, { pathname: located.pathname, slot });
    }

    const routed = handlerType === 'router';
    const moved = routed && isPageRequest(request) ? pageRedirect(request, located) : undefined;
    if (moved) return moved;

    const rendered = await next({ context: { session } });
    if (routed && located.occupied.includes(located.identity.slot)) {
      rendered.response.headers.set('cache-control', 'private, no-store');
    }
    return rendered;
  });
}
