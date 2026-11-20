import {
  deleteCookie,
  getCookie,
  getCookies,
  getRequest,
  setCookie,
} from '@tanstack/react-start/server';
import { isVideoAccessCookie } from '@vp/api-contracts';
import { VIDEO_UNLOCK_TTL_SECONDS } from '@vp/domain';
import { parseSetCookie, stringifyCookie } from 'cookie-es';
import { SESSION_COOKIE } from './session-config';

const SESSION_MAX_AGE_S = 8 * 60 * 60;
const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

function attributes(domain: string | undefined) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: !LOCAL_HOSTS.has(new URL(getRequest().url).hostname),
    domain,
  } as const;
}

/** The bearer token of the request being answered; server only, the browser never reads it. */
export function readSessionToken(): string | undefined {
  return getCookie(SESSION_COOKIE);
}

export function writeSessionCookie(token: string, domain: string | undefined): void {
  setCookie(SESSION_COOKIE, token, { ...attributes(domain), maxAge: SESSION_MAX_AGE_S });
}

/** Clears the cookie `writeSessionCookie` set for `domain`; a different domain clears nothing. */
export function clearSessionCookie(domain: string | undefined): void {
  deleteCookie(SESSION_COOKIE, attributes(domain));
}

/** The request's video unlock cookies as a `Cookie` header for the API, and none of its other cookies. */
export function readVideoAccessCookies(): string | undefined {
  const unlocks = Object.entries(getCookies()).filter(([name]) => isVideoAccessCookie(name));
  return unlocks.length > 0 ? stringifyCookie(Object.fromEntries(unlocks)) : undefined;
}

/**
 * Sets on this origin each video unlock cookie among the API's `Set-Cookie` headers, which the
 * browser never sees from the API itself; every other cookie the API sets stays with it.
 */
export function reissueVideoAccessCookies(setCookies: readonly string[]): void {
  for (const header of setCookies) {
    const cookie = parseSetCookie(header);
    if (cookie && isVideoAccessCookie(cookie.name)) {
      setCookie(cookie.name, cookie.value, {
        ...attributes(undefined),
        maxAge: cookie.maxAge ?? VIDEO_UNLOCK_TTL_SECONDS,
      });
    }
  }
}

/** `fetch` carrying the request's video unlock cookies, so a page reloaded after an unlock renders unlocked. */
export const withVideoAccessCookies: typeof fetch = (input, init) => {
  const unlocks = readVideoAccessCookies();
  if (!unlocks) return fetch(input, init);
  const headers = new Headers(init?.headers);
  headers.set('cookie', unlocks);
  return fetch(input, { ...init, headers });
};
