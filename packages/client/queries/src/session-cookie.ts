import { deleteCookie, getCookie, getRequest, setCookie } from '@tanstack/react-start/server';
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
