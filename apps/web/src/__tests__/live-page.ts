import type * as React from 'react';

const page = { live: false };

/**
 * `react` with `useSyncExternalStore` reading the client snapshot while `asLivePage` runs, so a
 * server render shows what the page shows after hydration. Install it with
 * `vi.mock(import('react'), async (importOriginal) => withLivePage(await importOriginal()))`.
 */
export function withLivePage(react: typeof React): typeof React {
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
  };
}

export function asLivePage<T>(render: () => T): T {
  page.live = true;
  const rendered = render();
  page.live = false;
  return rendered;
}
