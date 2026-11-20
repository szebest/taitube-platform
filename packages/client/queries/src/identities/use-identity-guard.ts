import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { identityKey } from '../account-slots';
import type { IdentityStore } from '../identity-store';
import { SESSION_KEY, type Session } from '../session';
import { useAccount, useIdentity } from '../session-provider';

export type IdentityGuard = {
  /** Sends `write` only while the tab still acts as the identity the composer was drawn for. */
  guard: (write: () => void) => void;
  /** A write was held back because the identity changed after the composer was drawn. */
  changed: boolean;
  /** The viewer read the notice and sends the held write as the identity acting now. */
  sendAnyway: () => void;
};

function viewerOf(identity: IdentityStore): string | undefined {
  const session = identity.queryClient().getQueryData<Session>(SESSION_KEY);
  return session?.status === 'signed-in' ? session.account.user.id : undefined;
}

/**
 * A composer's promise that a write leaves as the identity it shows: one fired after a switch (the
 * tab acting as another identity, or its session not yet the one drawn) is held and the composer
 * asks again, rather than posting as someone the viewer did not see.
 */
export function useIdentityGuard(): IdentityGuard {
  const { identity }: { identity: IdentityStore } = useRouter().options.context;
  const drawn = identityKey(useIdentity());
  const viewer = useAccount()?.user.id;
  const [held, setHeld] = useState<{ write: () => void }>();

  return {
    guard: (write) => {
      if (identity.key() === drawn && viewerOf(identity) === viewer) {
        write();
        return;
      }
      setHeld({ write });
    },
    changed: held !== undefined,
    sendAnyway: () => {
      setHeld(undefined);
      held?.write();
    },
  };
}
