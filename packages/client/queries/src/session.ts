import { assertNever, fromPromise, isOk } from '@kit/result';
import { type QueryClient, queryOptions } from '@tanstack/react-query';
import { type ApiClient, ApiError } from '@vp/api-client';
import type { Account } from '@vp/api-contracts';
import type { UserContext } from '@vp/permissions';
import type { Identity } from './account-slots';
import { UNAUTHORIZED } from './api-client';
import type { IdentityStore } from './identity-store';
import { expireSession, hasSession } from './session-functions';

export type Session =
  | { readonly status: 'guest'; readonly actingChannelId?: never }
  | {
      readonly status: 'signed-in';
      readonly account: Account;
      /** The channel the identity's `/c/<handle>` names, among those the account owns or works on. */
      readonly actingChannelId?: string;
    };

export const GUEST: Session = { status: 'guest' };

export const SESSION_KEY = ['session'] as const;

async function actingChannelOf(api: ApiClient, handle: string): Promise<string | undefined> {
  const { owned, member } = await api.myChannels.listMyIdentities();
  return [...owned, ...member].find((channel) => channel.handle === handle)?.id;
}

async function loadSession(api: ApiClient, { slot, channel }: Identity): Promise<Session> {
  if (!(await hasSession({ data: { slot } }))) return GUEST;

  const account = await fromPromise(
    () => api.me.getAccount(),
    (cause) => cause
  );
  if (!isOk(account)) {
    if (!(account.error instanceof ApiError && account.error.status === UNAUTHORIZED)) {
      throw account.error;
    }
    await expireSession({ data: { slot } });
    return GUEST;
  }

  const actingChannelId = channel ? await actingChannelOf(api, channel) : undefined;
  return { status: 'signed-in', account: account.value, actingChannelId };
}

/**
 * The session of `identity`, kept in that identity's own query cache: a guest's without a session
 * for its slot, else the account the slot's token reaches. A token the API refuses expires that
 * slot alone.
 */
export function sessionQueryOptions(api: ApiClient, identity: Identity) {
  return queryOptions({
    queryKey: SESSION_KEY,
    queryFn: () => loadSession(api, identity),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

type SessionSources = { queryClient: QueryClient; api: ApiClient; identity: IdentityStore };

/** The router identity's session, loaded once by the root route on the server and dehydrated into the page. */
export function ensureSession({ queryClient, api, identity }: SessionSources) {
  return queryClient.query({
    ...sessionQueryOptions(api, identity.read().identity),
    staleTime: 'static',
  });
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
