import { isOk, parseJson } from '@kit/result';
import { deleteCookie, getCookies, setCookie } from '@tanstack/react-start/server';
import type { z } from 'zod';
import {
  type AccountEntry,
  AccountRowSchema,
  type Accounts,
  AccountsCookieSchema,
  NO_ACCOUNTS,
  SLOT_COUNT,
  encodedLength,
} from './accounts';
import { cookieAttributes } from './session-cookie';

/** The browser-wide part of the slot list; scripts may read it, since it holds no token. */
const ACCOUNTS_COOKIE = 'vp.accounts';

const ACCOUNTS_MAX_AGE_S = 30 * 24 * 60 * 60;

/**
 * What one slot's row may take of a request, its name included: ten of them and the browser-wide
 * cookie fit the 4 KB the whole list had while it was one cookie.
 */
const ROW_COOKIE_BYTES_MAX = 320;

const rowCookieName = (slot: number) => `${ACCOUNTS_COOKIE}.${slot}`;

function parseCookie<T>(schema: z.ZodType<T>, raw: string | undefined): T | undefined {
  if (raw === undefined) return undefined;
  const json = parseJson(raw);
  const parsed = isOk(json) ? schema.safeParse(json.value) : undefined;
  return parsed?.success ? parsed.data : undefined;
}

function rowOf(cookies: Record<string, string>, slot: number): AccountEntry | undefined {
  const row = parseCookie(AccountRowSchema, cookies[rowCookieName(slot)]);
  return row && { slot, ...row };
}

/**
 * The browser's slot list: each slot's row from its own cookie, else from the rows `vp.accounts`
 * kept before rows had their own cookies.
 */
export function readAccounts(): Accounts {
  const cookies = getCookies();
  const { slots: kept = [], ...shared } =
    parseCookie(AccountsCookieSchema, cookies[ACCOUNTS_COOKIE]) ?? NO_ACCOUNTS;
  const rows = Array.from({ length: SLOT_COUNT }, (_, slot) => rowOf(cookies, slot)).filter(
    (row) => row !== undefined
  );
  const held = new Set(rows.map(({ slot }) => slot));
  const slots = [...rows, ...kept.filter(({ slot }) => !held.has(slot))];
  return { ...shared, slots: slots.toSorted((a, b) => a.slot - b.slot) };
}

/** A row as its cookie carries it, without the avatar hint when that would not fit the row's share. */
function serializeRow({ slot, ...row }: AccountEntry): string {
  const whole = JSON.stringify(row);
  if (encodedLength(`${rowCookieName(slot)}=${whole}`) <= ROW_COOKIE_BYTES_MAX) return whole;
  return JSON.stringify({ ...row, avatarUrl: null });
}

function serializeShared({ defaultSlot, accents = {}, pinned = [] }: Accounts): string {
  return JSON.stringify({
    defaultSlot,
    ...(Object.keys(accents).length > 0 && { accents }),
    ...(pinned.length > 0 && { pinned }),
  });
}

/**
 * Writes the cookies of `accounts` that differ from the ones the request carries, and only those,
 * so two requests in flight that change different slots both land. A cookie the request did not
 * carry is never cleared: another tab may have just set it. The `renewed` slot's row and the shared
 * cookie are set even when unchanged, so a sign-in restarts their lifetime.
 */
export function writeAccounts(
  accounts: Accounts,
  domain: string | undefined,
  renewed?: number
): void {
  const carried = getCookies();
  const write = (name: string, value: string | undefined, renew: boolean) => {
    if (value === undefined) {
      if (carried[name] !== undefined) deleteCookie(name, cookieAttributes(domain));
      return;
    }
    if (renew || value !== carried[name]) {
      setCookie(name, value, { ...cookieAttributes(domain), maxAge: ACCOUNTS_MAX_AGE_S });
    }
  };
  for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
    const row = accounts.slots.find((entry) => entry.slot === slot);
    write(rowCookieName(slot), row && serializeRow(row), slot === renewed);
  }
  write(
    ACCOUNTS_COOKIE,
    accounts.slots.length > 0 ? serializeShared(accounts) : undefined,
    renewed !== undefined
  );
}
