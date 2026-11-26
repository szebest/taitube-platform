import { type Result, fromPromise, ignore, isOk, ok } from '@kit/result';
import type { Toaster } from '@kit/ui';
import type { AnyRouter } from '@tanstack/react-router';
import type { ApiClient } from '@vp/api-client';
import { failureCode } from '../failure-code';
import type { IdentityState, IdentityStore } from '../identity-store';
import type { useT } from '../intl/shared-words';
import { unreadNotificationCountQueryOptions } from '../notification-queries';
import { present } from '../present-failure';
import { sessionQueryOptions } from '../session';
import { switchIdentity } from '../session-changes';
import { identitiesQueryOptions } from './identity-queries';
import type { SwitchTarget } from './identity-switcher-provider';

type SwitchRouter = AnyRouter & {
  options: {
    context: { identity: IdentityStore; apiAs: (slot: number) => ApiClient; toaster: Toaster };
  };
};

/** Whether the page the tab is on failed for the identity it now acts as: an error, a 404 or a refusal. */
function pageRefused(router: AnyRouter): boolean {
  return router.state.matches.some(({ status }) => status === 'error' || status === 'notFound');
}

/**
 * The switch refreshes the loaders behind the page the last identity loaded, so whether the new one
 * may see that page is known only once they finish: they are waited for here, off the switch's
 * own path, and a page they refuse is left for the fallback.
 */
async function leaveRefusedPage(router: SwitchRouter, fallback: string): Promise<void> {
  await router.invalidate({ sync: true });
  if (pageRefused(router)) await router.navigate({ to: fallback, replace: true });
}

/**
 * Switches the tab to `next` in place, with no document load: the page stays when the new identity
 * can see it and moves to `fallback` (replacing the entry) when it cannot, as soon as it knows. A switch that fails puts
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
    const rolledBack = await fromPromise(
      () => switchIdentity(router, previous.identity, { prefixed: previous.prefixed }),
      (cause) => cause
    );
    ignore(rolledBack, 'a rollback that fails too leaves the switch failure as the answer');
    return switched;
  }
  ignore(
    fromPromise(
      () => leaveRefusedPage(router, fallback),
      (cause) => cause
    ),
    'a page that cannot be left stays, and shows its own refusal'
  );
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

/** After a switch the page's heading takes focus, so a screen reader starts from the new page. */
function focusMainHeading(): void {
  requestAnimationFrame(() => {
    const heading =
      document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('h1');
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  });
}

export type FinishedSwitch = {
  router: SwitchRouter;
  outcome: Result<void, unknown>;
  target: SwitchTarget;
  tOr: ReturnType<typeof useT>['tOr'];
  announce: (text: string) => void;
  /** Goes back to where the switch came from; none when it came from nowhere to go back to. */
  undo: (() => void) | undefined;
};

/**
 * Says how a switch ended: a failed one toasts its reason, a done one is announced, takes the
 * page's heading as focus and toasts with Undo.
 */
export function finishSwitch({
  router,
  outcome,
  target,
  tOr,
  announce,
  undo,
}: FinishedSwitch): void {
  const { toaster } = router.options.context;
  const { name } = target.display;
  if (!isOk(outcome)) {
    toaster.show({
      tone: 'danger',
      title: tOr('accounts.switchFailed', { name }, ''),
      description: tOr(present({ code: failureCode(outcome.error) }).copy, {}, ''),
    });
    return;
  }
  const said = tOr('accounts.nowBrowsing', { name }, '');
  announce(said);
  focusMainHeading();
  toaster.show({
    title: said,
    action: undo && { label: tOr('accounts.undo', {}, ''), onAction: undo },
  });
}
