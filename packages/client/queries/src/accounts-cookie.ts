import { getCookie, setCookie } from '@tanstack/react-start/server';
import { type Accounts, parseAccounts } from './accounts';
import { cookieAttributes } from './session-cookie';

/** The browser's slot list; scripts may read it, since it holds no token. */
const ACCOUNTS_COOKIE = 'vp.accounts';

const ACCOUNTS_MAX_AGE_S = 30 * 24 * 60 * 60;

export function readAccounts(): Accounts {
  return parseAccounts(getCookie(ACCOUNTS_COOKIE));
}

export function writeAccounts(accounts: Accounts, domain: string | undefined): void {
  if (accounts.slots.length === 0) {
    setCookie(ACCOUNTS_COOKIE, '', { ...cookieAttributes(domain), maxAge: 0 });
    return;
  }
  setCookie(ACCOUNTS_COOKIE, JSON.stringify(accounts), {
    ...cookieAttributes(domain),
    maxAge: ACCOUNTS_MAX_AGE_S,
  });
}
