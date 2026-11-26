import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server';
import { cookieAttributes } from './session-cookie';

/** Binds an add-account flow to the browser that started it; one use, ten minutes. */
const ADD_NONCE_COOKIE = 'vp.add-nonce';

const ADD_NONCE_MAX_AGE_S = 10 * 60;

function nonceAttributes(domain: string | undefined) {
  return { ...cookieAttributes(domain), httpOnly: true } as const;
}

/** Starts an add: the state the provider flow carries, kept where no script reads it. */
export function issueAddNonce(domain: string | undefined): string {
  const nonce = crypto.randomUUID();
  setCookie(ADD_NONCE_COOKIE, nonce, { ...nonceAttributes(domain), maxAge: ADD_NONCE_MAX_AGE_S });
  return nonce;
}

/** Whether `state` is the nonce this browser holds; either way the nonce is spent. */
export function consumeAddNonce(state: string, domain: string | undefined): boolean {
  const held = getCookie(ADD_NONCE_COOKIE);
  if (held === undefined) return false;

  deleteCookie(ADD_NONCE_COOKIE, nonceAttributes(domain));
  return held === state;
}
