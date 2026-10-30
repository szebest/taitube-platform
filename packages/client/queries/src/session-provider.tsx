import type { Account } from '@vp/api-contracts';
import { PermissionsProvider } from '@vp/permissions-react';
import { createContext, type PropsWithChildren, useContext, useMemo } from 'react';

import { type Session, viewerOf } from './session';

const SessionContext = createContext<Session | undefined>(undefined);

export type SessionProviderProps = PropsWithChildren<{ session: Session }>;

/** The session the root route loaded into router context, and the permissions it grants below. */
export function SessionProvider({ session, children }: SessionProviderProps) {
  const viewer = useMemo(() => viewerOf(session), [session]);

  return (
    <SessionContext value={session}>
      <PermissionsProvider userContext={viewer}>{children}</PermissionsProvider>
    </SessionContext>
  );
}

/** The signed-in viewer's account, or `undefined` for a guest. */
export function useAccount(): Account | undefined {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useAccount must be used within SessionProvider');
  }
  return session.status === 'signed-in' ? session.account : undefined;
}
