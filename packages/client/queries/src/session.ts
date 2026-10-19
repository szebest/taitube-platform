import { type QueryClient, queryOptions } from '@tanstack/react-query';
import { type ApiClient, ApiError } from '@vp/api-client';
import type { Account } from '@vp/api-contracts';
import type { UserContext } from '@vp/permissions';
import { assertNever, fromPromise, isOk } from '@vp/result';

import { UNAUTHORIZED } from './api-client';
import { hasSession, signOut } from './session-functions';

export type Session =
  | { readonly status: 'guest' }
  | { readonly status: 'signed-in'; readonly account: Account };

export const GUEST: Session = { status: 'guest' };

export const SESSION_KEY = ['session'] as const;

async function loadSession(api: ApiClient): Promise<Session> {
  if (!(await hasSession())) return GUEST;

  const account = await fromPromise(
    () => api.me.getAccount(),
    (cause) => cause
  );
  if (isOk(account)) return { status: 'signed-in', account: account.value };
  if (!(account.error instanceof ApiError && account.error.status === UNAUTHORIZED)) {
    throw account.error;
  }

  await signOut();
  return GUEST;
}

/**
 * The viewer's session in the router's query cache, loaded once by the root route on the server
 * and dehydrated into the page: a guest's without a session cookie, else the account its token
 * reaches. A token the API refuses signs the viewer out.
 */
export function ensureSession({ queryClient, api }: { queryClient: QueryClient; api: ApiClient }) {
  return queryClient.ensureQueryData(
    queryOptions({
      queryKey: SESSION_KEY,
      queryFn: () => loadSession(api),
      staleTime: Number.POSITIVE_INFINITY,
    })
  );
}

/** Who `@vp/permissions` decides for: the account's user and the role its token carries. */
export function viewerOf(session: Session): UserContext | null {
  switch (session.status) {
    case 'guest':
      return null;
    case 'signed-in':
      return {
        id: session.account.user.id,
        role: session.account.role,
        email: session.account.user.email,
      };
    default:
      return assertNever(session, 'session status');
  }
}
