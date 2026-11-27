import { deleteCookie, getCookies, setCookie } from '@tanstack/react-start/server';
import { parseSlot } from './account-slots';
import { firstFreeSlot } from './accounts';
import { readAccounts } from './accounts-cookie';
import { cookieAttributes, occupiedSlots } from './session-cookie';

/**
 * Binds an add-account flow to the browser that started it; one use, ten minutes. Named
 * `vp.add-nonce.<slot>` it also holds that slot for the add, so a second add started meanwhile
 * takes another; bare, it holds none (every slot was taken when the add started).
 */
const ADD_NONCE_COOKIE = 'vp.add-nonce';

const ADD_NONCE_MAX_AGE_S = 10 * 60;

function nonceAttributes(domain: string | undefined) {
  return { ...cookieAttributes(domain), httpOnly: true } as const;
}

type HeldNonce = { readonly name: string; readonly value: string; readonly slot?: number };

function heldNonces(): HeldNonce[] {
  return Object.entries(getCookies()).flatMap(([name, value]) => {
    if (name === ADD_NONCE_COOKIE) return [{ name, value }];
    if (!name.startsWith(`${ADD_NONCE_COOKIE}.`)) return [];
    const slot = parseSlot(name.slice(ADD_NONCE_COOKIE.length + 1));
    return slot === undefined ? [] : [{ name, value, slot }];
  });
}

/**
 * Starts an add: the state the provider flow carries, kept where no script reads it, holding the
 * slot the add will take, one no session and no other add in flight holds. With none left it
 * takes over the lowest an add holds, whose own sign-in then picks again.
 */
export function issueAddNonce(domain: string | undefined, accountsMax: number): string {
  const accounts = readAccounts();
  const occupied = occupiedSlots();
  const reserved = heldNonces().flatMap(({ slot }) => (slot === undefined ? [] : [slot]));
  const slot =
    firstFreeSlot(accounts, [...occupied, ...reserved], accountsMax) ??
    firstFreeSlot(accounts, occupied, accountsMax);
  const nonce = crypto.randomUUID();
  setCookie(slot === undefined ? ADD_NONCE_COOKIE : `${ADD_NONCE_COOKIE}.${slot}`, nonce, {
    ...nonceAttributes(domain),
    maxAge: ADD_NONCE_MAX_AGE_S,
  });
  return nonce;
}

type SpentNonce =
  | { readonly kind: 'spent'; readonly reserved: number | undefined }
  | { readonly kind: 'unknown' };

/** Spends the nonce `state` names, answering the slot it held; a state this browser never issued spends nothing. */
export function consumeAddNonce(state: string, domain: string | undefined): SpentNonce {
  const held = heldNonces().find(({ value }) => value === state);
  if (held === undefined) return { kind: 'unknown' };

  deleteCookie(held.name, nonceAttributes(domain));
  return { kind: 'spent', reserved: held.slot };
}
