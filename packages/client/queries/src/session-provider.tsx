import type { Account } from '@vp/api-contracts';
import { PermissionsProvider } from '@vp/permissions-react';
import { type PropsWithChildren, createContext, useContext } from 'react';
import { type Identity, appLink, identityKey } from './account-slots';
import { type Session, viewerOf } from './session';

type SessionValue = { session: Session; identity: Identity; prefixed: boolean };

const SessionContext = createContext<SessionValue | undefined>(undefined);

const FIRST_SLOT: Identity = { slot: 0 };

export type SessionProviderProps = PropsWithChildren<{
  session: Session;
  /** The identity the session belongs to; a one-account browser's is its first slot. */
  identity?: Identity;
  /** Whether the browser's URLs carry the identity's prefix. */
  prefixed?: boolean;
}>;

function useSessionValue(hook: string): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error(`${hook} must be used within SessionProvider`);
  }
  return value;
}

/**
 * The session the root route loaded into router context, and the permissions it grants below,
 * keyed by the identity and its viewer: a switch, a sign-in or a sign-out mounts the tree below
 * again, so no ability, stream, query observer (which keeps the cache it was built with) or state
 * of the last one outlives it.
 */
export function SessionProvider({
  session,
  identity = FIRST_SLOT,
  prefixed = false,
  children,
}: SessionProviderProps) {
  const viewer = viewerOf(session);

  return (
    <SessionContext value={{ session, identity, prefixed }}>
      <PermissionsProvider
        key={`${identityKey(identity)}.${viewer?.id ?? 'guest'}`}
        userContext={viewer}
      >
        {children}
      </PermissionsProvider>
    </SessionContext>
  );
}

/** The signed-in viewer's account, or `undefined` for a guest. */
export function useAccount(): Account | undefined {
  const { session } = useSessionValue('useAccount');
  return session.status === 'signed-in' ? session.account : undefined;
}

/** The identity this tab acts as. */
export function useIdentity(): Identity {
  return useSessionValue('useIdentity').identity;
}

/** `appLink` for this tab: a link into the other app opens as the same account and channel. */
export function useAppLink(): (origin: string, path?: string) => string {
  const tab = useSessionValue('useAppLink');
  return (origin, path = '/') => appLink(origin, path, tab);
}
