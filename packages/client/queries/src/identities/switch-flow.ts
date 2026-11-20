import { type Result, fromPromise, isOk, ok } from '@kit/result';
import type { AnyRouter } from '@tanstack/react-router';
import type { ApiClient } from '@vp/api-client';
import type { IdentityState, IdentityStore } from '../identity-store';
import { unreadNotificationCountQueryOptions } from '../notification-queries';
import { sessionQueryOptions } from '../session';
import { switchIdentity } from '../session-changes';
import { identitiesQueryOptions } from './identity-queries';

type SwitchRouter = AnyRouter & {
  options: { context: { identity: IdentityStore; apiAs: (slot: number) => ApiClient } };
};

/** Whether the page the tab is on failed for the identity it now acts as: an error, a 404 or a refusal. */
function pageRefused(router: AnyRouter): boolean {
  return router.state.matches.some(({ status }) => status === 'error' || status === 'notFound');
}

/**
 * Switches the tab to `next` in place, with no document load: the page stays when the new identity
 * can see it and moves to `fallback` (replacing the entry) when it cannot. A switch that fails puts
 * the tab back on the identity it left and answers the cause.
 */
export async function switchInPlace(
  router: SwitchRouter,
  next: IdentityState,
  fallback: string
): Promise<Result<void, unknown>> {
  const previous = router.options.context.identity.read();
  const switched = await fromPromise(
    () => switchIdentity(router, next.identity, { prefixed: next.prefixed }),
    (cause) => cause
  );
  if (!isOk(switched)) {
    await fromPromise(
      () => switchIdentity(router, previous.identity, { prefixed: previous.prefixed }),
      (cause) => cause
    );
    return switched;
  }
  if (pageRefused(router)) await router.navigate({ to: fallback, replace: true });
  return ok(undefined);
}

/**
 * Fills the cache a switch to `next` will land on with its shell's data (the session, its
 * identities, its unread count), at most once per 5 seconds per identity.
 */
export function prefetchIdentity(router: SwitchRouter, next: IdentityState): void {
  const { identity, apiAs } = router.options.context;
  const cache = identity.prepare(next);
  if (!cache) return;
  const api = apiAs(next.identity.slot);
  void cache.prefetchQuery(sessionQueryOptions(api, next.identity));
  void cache.prefetchQuery(identitiesQueryOptions(api));
  void cache.prefetchQuery(unreadNotificationCountQueryOptions(api));
}
