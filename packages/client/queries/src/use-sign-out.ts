import { useRouter } from '@tanstack/react-router';

import { settleSession } from './session-changes';
import { signOut } from './session-functions';

/** Signs the viewer out of both apps, then loads the routes again as a guest, with no reload. */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();

  return async () => {
    await signOut();
    await settleSession(router);
  };
}
