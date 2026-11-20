import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { type Identity, identityKey, parseIdentityPath } from './account-slots';
import type { IdentityStore } from './identity-store';
import { endSession, followIdentity } from './session-changes';
import { hasSession } from './session-functions';

const SESSION_SYNC_CHANNEL = 'vp.session-sync';

/** What one tab tells this origin's others: an account added, or slots signed out. */
export type SessionChange =
  | { readonly type: 'added'; readonly slot: number }
  | { readonly type: 'signed-out'; readonly slots: readonly number[] };

export function announceSessionChange(change: SessionChange): void {
  const channel = new BroadcastChannel(SESSION_SYNC_CHANNEL);
  channel.postMessage(change);
  channel.close();
}

function slotOf(identity: IdentityStore): number {
  return identity.read().identity.slot;
}

/** The identity the browser's URL now names, when it is not the one the tab acts as. */
function otherIdentity(identity: IdentityStore, pathname: string): Identity | undefined {
  const named = parseIdentityPath(pathname).identity;
  return named && identityKey(named) !== identity.key() ? named : undefined;
}

/**
 * Keeps this tab in step with the sessions other tabs change. A tab on a slot signed out elsewhere
 * goes to `/login`, the rest stay put, and a second account makes every tab's links carry the
 * prefix. The other app is another origin, which no `BroadcastChannel` reaches: a tab coming back
 * into focus asks whether its slot still has a session. Back or forward onto an entry made under
 * another identity acts as that identity again.
 */
export function useSessionSync(): void {
  const router = useRouter();

  useEffect(() => {
    const { identity } = router.options.context;
    const channel = new BroadcastChannel(SESSION_SYNC_CHANNEL);
    const onChange = ({ data }: MessageEvent<SessionChange>) => {
      if (data.type === 'added') {
        if (data.slot !== slotOf(identity)) identity.markPrefixed();
        return;
      }
      if (data.slots.includes(slotOf(identity))) {
        endSession(router, slotOf(identity), { expired: false });
      }
    };
    const onFocus = async () => {
      const slot = slotOf(identity);
      if (!(await hasSession({ data: { slot } }))) endSession(router, slot, { expired: false });
    };
    channel.addEventListener('message', onChange);
    window.addEventListener('focus', onFocus);
    const stopWatchingHistory = router.history.subscribe(() => {
      const named = otherIdentity(identity, router.history.location.pathname);
      if (named) void followIdentity(router, named);
    });
    return () => {
      channel.removeEventListener('message', onChange);
      channel.close();
      window.removeEventListener('focus', onFocus);
      stopWatchingHistory();
    };
  }, [router]);
}
