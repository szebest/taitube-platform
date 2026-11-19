import { useRouter } from '@tanstack/react-router';
import { settleSession, switchIdentity } from './session-changes';
import { signOut, signOutAll } from './session-functions';
import { announceSessionChange } from './session-sync';

/**
 * Signs this tab's account out of both apps, leaving every other slot signed in, and moves the tab
 * to the default of the accounts left, or loads the routes again as a guest, with no reload.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();

  return async () => {
    const { slot } = router.options.context.identity.read().identity;
    const { next, accounts } = await signOut({ data: { slot } });
    announceSessionChange({ type: 'signed-out', slots: [slot] });
    if (next) {
      await switchIdentity(router, next, { prefixed: accounts > 1 });
      return;
    }
    await settleSession(router);
  };
}

/**
 * Signs every account in this browser out, and loads the routes again as a guest.
 * @public
 */
export function useSignOutAll(): () => Promise<void> {
  const router = useRouter();

  return async () => {
    announceSessionChange({ type: 'signed-out', slots: await signOutAll() });
    await settleSession(router);
  };
}
