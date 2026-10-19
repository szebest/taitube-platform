import { SESSION_COOKIE } from '../../packages/client/queries/src/session-cookie';

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
