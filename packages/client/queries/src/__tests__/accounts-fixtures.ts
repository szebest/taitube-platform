import type { Accounts } from '../accounts';
import { readAccounts } from '../accounts-cookie';
import { inRequest } from './in-request';

/** The cookies a browser holding `accounts` sends: one per slot's row, and the browser-wide part. */
export function accountsCookies({ slots, ...shared }: Accounts): string {
  const rows = slots.map(
    ({ slot, ...row }) => `vp.accounts.${slot}=${encodeURIComponent(JSON.stringify(row))}`
  );
  return [...rows, `vp.accounts=${encodeURIComponent(JSON.stringify(shared))}`].join('; ');
}

/** The `Cookie` header a browser sends after it stored each response's `Set-Cookie`, in order. */
export function cookiesAfter(cookie: string, ...responses: (readonly string[])[]): string {
  const jar = new Map(
    cookie
      .split('; ')
      .filter(Boolean)
      .map((pair) => [pair.slice(0, pair.indexOf('=')), pair])
  );
  for (const header of responses.flat()) {
    const [pair = ''] = header.split(';');
    const name = pair.slice(0, pair.indexOf('='));
    if (header.includes('; Max-Age=0;')) jar.delete(name);
    else jar.set(name, pair);
  }
  return [...jar.values()].join('; ');
}

/** The slot list the browser holds once it stored `setCookies` over the `cookie` it sent. */
export async function accountsAfter(cookie: string, setCookies: readonly string[]) {
  return (await inRequest(readAccounts, { cookie: cookiesAfter(cookie, setCookies) })).value;
}
