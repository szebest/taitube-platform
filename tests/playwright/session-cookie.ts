import { SESSION_COOKIE } from '../../packages/client/queries/src/session-config';

/** The session cookie the apps' sign-in sets, for a browser `token` signed in at `url`. */
export function sessionCookie(token: string, url: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    domain: new URL(url).hostname,
    path: '/',
    expires: -1,
    httpOnly: true,
    secure: false,
    sameSite: 'Lax' as const,
  };
}

/** The cookie of one account slot, as a browser holding several accounts carries it. */
export function slotCookie(slot: number, token: string, url: string) {
  return { ...sessionCookie(token, url), name: `${SESSION_COOKIE}.${slot}` };
}

/** One row of the browser's slot list, `vp.accounts`, which scripts may read. */
export type SlotRow = { slot: number; userId: string; label: string };

/** The slot list a browser signed in to `rows` keeps, the default slot first among them. */
export function accountsCookie(rows: readonly SlotRow[], defaultSlot: number, url: string) {
  const slots = rows.map((row) => ({ ...row, avatarUrl: null, channel: null, expired: false }));
  return {
    ...sessionCookie('', url),
    name: 'vp.accounts',
    value: encodeURIComponent(JSON.stringify({ defaultSlot, slots })),
    httpOnly: false,
  };
}
