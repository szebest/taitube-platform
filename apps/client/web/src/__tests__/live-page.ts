import type * as React from 'react';

declare global {
  var livePageForSpecs: { live: boolean } | undefined;
}

// On globalThis: a mocked `react` outlives the spec file that installed it when files share a worker.
globalThis.livePageForSpecs ??= { live: false };
const page = globalThis.livePageForSpecs;

/**
 * `react` as a hydrated page runs it while `asLivePage` does: `useSyncExternalStore` reads the client
 * snapshot and `useEffect` runs its effect, so a server render shows what the live page shows.
 * `live-page.setup.ts` installs it for every spec.
 */
export function withLivePage(react: typeof React): typeof React {
  // biome-ignore-start lint/correctness/useHookAtTopLevel: `page.live` only flips between renders, so one render always takes one branch.
  return {
    ...react,
    useSyncExternalStore: <Snapshot>(
      subscribe: (onStoreChange: () => void) => () => void,
      getSnapshot: () => Snapshot,
      getServerSnapshot?: () => Snapshot
    ): Snapshot =>
      page.live
        ? getSnapshot()
        : react.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
    useEffect: (effect: React.EffectCallback, deps?: React.DependencyList): void => {
      if (page.live) effect();
      else react.useEffect(effect, deps);
    },
  };
  // biome-ignore-end lint/correctness/useHookAtTopLevel: `page.live` only flips between renders
}

export function asLivePage<T>(render: () => T): T {
  page.live = true;
  const rendered = render();
  page.live = false;
  return rendered;
}
