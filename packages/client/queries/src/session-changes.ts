import type { QueryClient } from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';

import { GUEST, SESSION_KEY, type Session } from './session';

type SessionRouter = AnyRouter & { options: { context: { queryClient: QueryClient } } };

function queryClientOf(router: SessionRouter): QueryClient {
  return router.options.context.queryClient;
}

/**
 * After a sign-in or a sign-out: the cache held the last viewer's data, so it goes, and the routes
 * load again as the new viewer, which runs the guards (`/login` moves a signed-in viewer on).
 */
export function settleSession(router: SessionRouter): Promise<void> {
  queryClientOf(router).clear();
  return router.invalidate();
}

/**
 * A 401 to a signed-in viewer means the session ended under them (the proxy already cleared the
 * cookie): they sign in again and come back to where they were, with no page reload. A guest's 401
 * is only a refusal.
 */
export function endSession(router: SessionRouter): void {
  const queryClient = queryClientOf(router);
  if (queryClient.getQueryData<Session>(SESSION_KEY)?.status !== 'signed-in') return;

  queryClient.clear();
  queryClient.setQueryData(SESSION_KEY, GUEST);
  void router.navigate({
    to: '/login',
    search: { redirect: router.state.location.href, reason: 'expired' },
  });
}
