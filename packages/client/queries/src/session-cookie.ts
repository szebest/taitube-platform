import {
  deleteCookie,
  getCookie,
  getCookies,
  getRequest,
  setCookie,
} from '@tanstack/react-start/server';
import { parseSlot } from './account-slots';
import { SESSION_COOKIE } from './session-config';

const SESSION_MAX_AGE_S = 8 * 60 * 60;
const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The attributes both apps write their cookies with, so either one can replace or clear them. */
export function cookieAttributes(domain: string | undefined) {
  return {
    sameSite: 'lax',
    path: '/',
    secure: !LOCAL_HOSTS.has(new URL(getRequest().url).hostname),
    domain,
  } as const;
}

function sessionAttributes(domain: string | undefined) {
  return { ...cookieAttributes(domain), httpOnly: true } as const;
}

function sessionCookieName(slot: number): string {
  return `${SESSION_COOKIE}.${slot}`;
}

/**
 * The bearer token slot `slot` holds in the request being answered; server only, the browser never
 * reads it. Slot 0 is also the single cookie a browser signed in with before there were slots.
 */
export function readSessionToken(slot: number): string | undefined {
  return getCookie(sessionCookieName(slot)) ?? (slot === 0 ? getCookie(SESSION_COOKIE) : undefined);
}

export function writeSessionCookie(slot: number, token: string, domain: string | undefined): void {
  setCookie(sessionCookieName(slot), token, {
    ...sessionAttributes(domain),
    maxAge: SESSION_MAX_AGE_S,
  });
}

/** Clears the slot `writeSessionCookie` set for `domain`, and leaves every other slot alone. */
export function clearSessionCookie(slot: number, domain: string | undefined): void {
  deleteCookie(sessionCookieName(slot), sessionAttributes(domain));
  if (slot === 0 && getCookie(SESSION_COOKIE) !== undefined) {
    deleteCookie(SESSION_COOKIE, sessionAttributes(domain));
  }
}

/** The slots the request carries a session for, lowest first. */
export function occupiedSlots(): number[] {
  const names = Object.keys(getCookies());
  const slots = names
    .filter((name) => name.startsWith(`${SESSION_COOKIE}.`))
    .map((name) => parseSlot(name.slice(SESSION_COOKIE.length + 1)))
    .filter((slot) => slot !== undefined);
  if (names.includes(SESSION_COOKIE)) slots.push(0);
  return [...new Set(slots)].toSorted((a, b) => a - b);
}

/** Moves the single cookie of a browser signed in before slots into slot 0, once. */
export function migrateLegacySession(domain: string | undefined): void {
  const legacy = getCookie(SESSION_COOKIE);
  if (legacy === undefined) return;

  if (getCookie(sessionCookieName(0)) === undefined) writeSessionCookie(0, legacy, domain);
  deleteCookie(SESSION_COOKIE, sessionAttributes(domain));
}
