import { createServerFn } from '@tanstack/react-start';
import { AccountSlotSchema } from '@vp/api-contracts';
import { z } from 'zod';
import type { Identity } from './account-slots';
import {
  AccountChannelSchema,
  NO_ACCOUNTS,
  defaultSlotOf,
  withDefault,
  withExpired,
  withoutSlot,
} from './accounts';
import { readAccounts, writeAccounts } from './accounts-cookie';
import { issueAddNonce } from './add-account-nonce';
import { requestSession } from './session-config';
import { clearSessionCookie, occupiedSlots, readSessionToken } from './session-cookie';

const SlotInputSchema = z.strictObject({ slot: AccountSlotSchema });

/** Where a tab goes once its slot signed out: the default of the slots left, or nowhere. */
export type AfterSignOut = { readonly next: Identity | undefined; readonly accounts: number };

/** Whether the request carries a session for `slot`, which the browser's scripts cannot see. */
export const hasSession = createServerFn({ method: 'GET' })
  .validator(SlotInputSchema)
  .handler(({ data }) => readSessionToken(data.slot) !== undefined);

/** Signs `slot` out alone: its cookie and its row go, every other slot keeps its session. */
export const signOut = createServerFn({ method: 'POST' })
  .validator(SlotInputSchema)
  .handler(({ data }): AfterSignOut => {
    const { cookieDomain } = requestSession();
    clearSessionCookie(data.slot, cookieDomain);
    const accounts = withoutSlot(readAccounts(), data.slot);
    writeAccounts(accounts, cookieDomain);
    const left = occupiedSlots().filter((slot) => slot !== data.slot);
    return {
      next: left.length > 0 ? { slot: defaultSlotOf(accounts, left) } : undefined,
      accounts: left.length,
    };
  });

/** Signs every slot out and forgets the slot list; answers the slots it cleared. */
export const signOutAll = createServerFn({ method: 'POST' }).handler(() => {
  const { cookieDomain } = requestSession();
  const cleared = occupiedSlots();
  for (const slot of cleared) clearSessionCookie(slot, cookieDomain);
  writeAccounts(NO_ACCOUNTS, cookieDomain);
  return cleared;
});

/** The API refused `slot`'s token: that slot alone is cleared and its row marked for a re-auth. */
export const expireSession = createServerFn({ method: 'POST' })
  .validator(SlotInputSchema)
  .handler(({ data }) => {
    const { cookieDomain } = requestSession();
    clearSessionCookie(data.slot, cookieDomain);
    writeAccounts(withExpired(readAccounts(), data.slot), cookieDomain);
  });

/** A tab switched to this identity: a new tab with no prefix opens as it. */
export const rememberIdentity = createServerFn({ method: 'POST' })
  .validator(z.strictObject({ slot: AccountSlotSchema, channel: AccountChannelSchema.nullable() }))
  .handler(({ data }) => {
    writeAccounts(
      withDefault(readAccounts(), data.slot, data.channel),
      requestSession().cookieDomain
    );
  });

/** Starts adding an account: the one-time state its sign-in must bring back. */
export const startAddAccount = createServerFn({ method: 'POST' }).handler(() =>
  issueAddNonce(requestSession().cookieDomain)
);
