import type { QueryClient } from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';
import { type Identity, identityPath } from './account-slots';
import type { IdentityStore } from './identity-store';
import { GUEST, SESSION_KEY, type Session } from './session';
import { rememberIdentity } from './session-functions';

type SessionContext = { queryClient: QueryClient; identity: IdentityStore };

type SessionRouter = AnyRouter & { options: { context: SessionContext } };

/** Loaders and `useQueryClient` read `queryClient` from here from now on; the dropped one is never read again. */
function adoptCache(router: SessionRouter, queryClient: QueryClient): void {
  router.update({ ...router.options, context: { ...router.options.context, queryClient } });
}

type SwitchOptions = {
  /** Whether the browser holds more than one account, so URLs carry the prefix. */
  prefixed?: boolean;
  /** Where the tab lands, unprefixed; the page it is on by default. */
  href?: string;
};

/**
 * Moves this tab to another identity in place: the next identity's own cache, the routes loaded
 * again as it, and the URL under its prefix, replacing the entry rather than adding one. A new tab
 * with no prefix opens as it from now on.
 */
export async function switchIdentity(
  router: SessionRouter,
  next: Identity,
  { prefixed = true, href = router.state.location.href }: SwitchOptions = {}
): Promise<void> {
  adoptCache(router, router.options.context.identity.switchTo({ identity: next, prefixed }));
  await rememberIdentity({ data: { slot: next.slot, channel: next.channel ?? null } });
  const { pathname, search, hash } = new URL(href, router.origin);
  router.history.replace(`${identityPath(prefixed ? next : undefined, pathname)}${search}${hash}`);
  await router.invalidate();
}

/**
 * After a sign-in or a sign-out of this tab's slot: the cache held the last viewer's data, so a
 * new one replaces it, and the routes load again as the new viewer, which runs the guards (`/login`
 * moves a signed-in viewer on).
 */
export function settleSession(router: SessionRouter): Promise<void> {
  adoptCache(router, router.options.context.identity.renew());
  return router.invalidate();
}

/**
 * A 401 to a signed-in viewer on this tab's slot means its session ended under them (the proxy
 * already cleared that slot): they sign that slot in again and come back to where they were, with
 * no page reload. The same when another tab or app signed the slot out (`expired: false`). A
 * guest's 401, or one for a slot this tab has left, is only a refusal.
 */
export function endSession(router: SessionRouter, slot: number, { expired = true } = {}): void {
  const { identity, queryClient }: SessionContext = router.options.context;
  if (identity.read().identity.slot !== slot) return;
  if (queryClient.getQueryData<Session>(SESSION_KEY)?.status !== 'signed-in') return;

  const renewed = identity.renew();
  adoptCache(router, renewed);
  renewed.setQueryData(SESSION_KEY, GUEST);
  const reason = expired ? 'expired' : undefined;
  void router.navigate({
    to: '/login',
    search: { redirect: router.state.location.href, reason, slot },
  });
}
