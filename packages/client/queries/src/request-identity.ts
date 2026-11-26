import { getRequest, getRequestHeader } from '@tanstack/react-start/server';
import { ACCOUNT_SLOT_HEADER, type Identity, parseIdentityPath, parseSlot } from './account-slots';
import { type Accounts, defaultSlotOf } from './accounts';
import { readAccounts } from './accounts-cookie';
import { occupiedSlots } from './session-cookie';

export type RequestIdentity = {
  /** The identity the request acts as: its prefix, else its `X-Account-Slot`, else the default. */
  identity: Identity;
  /** Whether the URL named the identity, which every link of the page then keeps. */
  prefixed: boolean;
  /** The slots the request carries a session for. */
  occupied: number[];
  /** The identity a tab with no prefix opens as: the last one switched to. */
  defaultIdentity: Identity;
  /** The path the routes match, without the prefix. */
  pathname: string;
};

function defaultIdentityOf(accounts: Accounts, occupied: readonly number[]): Identity {
  const slot = defaultSlotOf(accounts, occupied);
  const channel = accounts.slots.find((entry) => entry.slot === slot)?.channel;
  return channel ? { slot, channel } : { slot };
}

/** Who the request being answered acts as, read before any loader runs; server only. */
export function resolveRequestIdentity(): RequestIdentity {
  const located = parseIdentityPath(new URL(getRequest().url).pathname);
  const occupied = occupiedSlots();
  const defaultIdentity = defaultIdentityOf(readAccounts(), occupied);
  const headerSlot = parseSlot(getRequestHeader(ACCOUNT_SLOT_HEADER));
  const identity =
    located.identity ?? (headerSlot === undefined ? defaultIdentity : { slot: headerSlot });
  return {
    identity,
    prefixed: located.identity !== undefined,
    occupied,
    defaultIdentity,
    pathname: located.pathname,
  };
}
