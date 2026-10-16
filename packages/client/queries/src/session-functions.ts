import { createServerFn } from '@tanstack/react-start';

import { requestCookieDomain } from './session-config';
import { clearSessionCookie, readSessionToken } from './session-cookie';

/** Whether the request carries a session cookie, which the browser's scripts cannot see. */
export const hasSession = createServerFn({ method: 'GET' }).handler(
  () => readSessionToken() !== undefined
);

export const signOut = createServerFn({ method: 'POST' }).handler(() => {
  clearSessionCookie(requestCookieDomain());
});
