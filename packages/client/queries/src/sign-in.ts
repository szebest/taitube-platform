import { fromPromise, isOk } from '@kit/result';
import { getRequest } from '@tanstack/react-start/server';
import { ApiError, createApiClient } from '@vp/api-client';
import { firstFreeSlot, slotOfUser, withSignedIn } from './accounts';
import { readAccounts, writeAccounts } from './accounts-cookie';
import { consumeAddNonce } from './add-account-nonce';
import { forwardedFor } from './api-proxy';
import { DEFAULT_API_BASE_URL } from './parse-client-env';
import { requestSession } from './session-config';
import { occupiedSlots, writeSessionCookie } from './session-cookie';

const TOO_MANY_REQUESTS = 429;

/**
 * Where a sign-in lands: a free slot beside the others (an add, bound to its nonce), or one slot. A
 * new user into one slot beside others is an add too, so it carries the nonce of one.
 */
export type SignInTarget =
  | { readonly mode: 'add'; readonly state: string }
  | { readonly mode: 'slot'; readonly slot: number; readonly state?: string };

export type SignInOutcome =
  | { readonly kind: 'signed-in'; readonly slot: number; readonly accounts: number }
  | { readonly kind: 'already-signed-in'; readonly slot: number; readonly accounts: number }
  | { readonly kind: 'accounts-full' }
  | { readonly kind: 'rate-limited' }
  | { readonly kind: 'slot-taken' }
  | { readonly kind: 'refused' };

/** The provider's half of a sign-in: a grant (a demo persona, a provider's code) in, a new token out. */
export type TokenIssuer = (grant: string) => Promise<string>;

function isTooManyRequests(cause: unknown): boolean {
  return cause instanceof ApiError && cause.status === TOO_MANY_REQUESTS;
}

/**
 * The callback of every sign-in, server only: an add first spends its nonce, so a state this
 * browser did not start signs nothing in, and takes the slot its nonce held while that is free.
 * The token is always a new one from `issue`, never one the request carries. A user already in a
 * slot, signed in or expired, ends on that slot, so one user never holds two; a session past
 * `ACCOUNTS_MAX` is refused, and the API records the sign-in (rate-limiting an add) before the
 * cookie is written.
 */
export async function completeSignIn(
  issue: TokenIssuer,
  grant: string,
  target: SignInTarget
): Promise<SignInOutcome> {
  const { apiBaseUrl = DEFAULT_API_BASE_URL, cookieDomain, accountsMax } = requestSession();
  const spent = target.mode === 'add' ? consumeAddNonce(target.state, cookieDomain) : undefined;
  if (spent?.kind === 'unknown') return { kind: 'refused' };

  const token = await issue(grant);
  const api = createApiClient({ baseUrl: apiBaseUrl, getAuthToken: () => token });
  const account = await api.me.getAccount();
  const accounts = readAccounts();
  const occupied = occupiedSlots();
  const listed = slotOfUser(accounts, account.user.id);
  if (target.mode === 'slot' && listed === undefined && occupied.includes(target.slot)) {
    return { kind: 'slot-taken' };
  }
  const reserved = spent?.kind === 'spent' ? spent.reserved : undefined;
  const freeSlot =
    reserved !== undefined && reserved < accountsMax && !occupied.includes(reserved)
      ? reserved
      : firstFreeSlot(accounts, occupied, accountsMax);
  const slot = listed ?? (target.mode === 'slot' ? target.slot : freeSlot);
  const full = occupied.length >= accountsMax;
  if (slot === undefined || (full && !occupied.includes(slot))) return { kind: 'accounts-full' };
  const added = listed === undefined && (target.mode === 'add' || occupied.length > 0);
  if (
    added &&
    target.mode === 'slot' &&
    (target.state === undefined || consumeAddNonce(target.state, cookieDomain).kind !== 'spent')
  ) {
    return { kind: 'refused' };
  }

  const request = getRequest();
  const hops = forwardedFor(request);
  const userAgent = request.headers.get('user-agent');
  const recorded = await fromPromise(
    () =>
      api.accountSecurity.recordMySignIn({
        body: { slot, added },
        headers: {
          ...(hops && { 'x-forwarded-for': hops }),
          ...(userAgent && { 'user-agent': userAgent }),
        },
      }),
    (cause) => cause
  );
  if (!isOk(recorded)) {
    if (isTooManyRequests(recorded.error)) return { kind: 'rate-limited' };
    throw recorded.error;
  }

  writeSessionCookie(slot, token, cookieDomain);
  const signedIn = {
    slot,
    userId: account.user.id,
    label: account.channel.displayName,
    avatarUrl: account.channel.avatarUrl,
  };
  writeAccounts(withSignedIn(accounts, signedIn), cookieDomain, slot);
  const held = new Set([...occupied, slot]).size;
  return listed !== undefined && occupied.includes(listed)
    ? { kind: 'already-signed-in', slot, accounts: held }
    : { kind: 'signed-in', slot, accounts: held };
}
