import { QueryClient } from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';

const SETTLE_TIMEOUT_MS = 5_000;

const clients = new Set<QueryClient>();
const routers = new Set<AnyRouter>();

export class LeakedUpdateError extends Error {
  constructor(test: string) {
    super(
      `"${test}" set React state after it ended: await what the test started (the request, the mutation, the navigation) before its last assertion`
    );
    this.name = 'LeakedUpdateError';
  }
}

/** Remembers every `QueryClient` a test mounts, so the test ends only once its work has. */
export function trackQueryClients(): void {
  const mount = QueryClient.prototype.mount;
  QueryClient.prototype.mount = function (this: QueryClient) {
    clients.add(this);
    mount.call(this);
  };
}

/** A router the test rendered, which ends the test only once it is idle. */
export function trackRouter(router: AnyRouter): void {
  routers.add(router);
}

function busy(): string[] {
  const queries = [...clients].flatMap((client) =>
    client
      .getQueryCache()
      .findAll({ fetchStatus: 'fetching' })
      .map(({ queryKey }) => `query ${JSON.stringify(queryKey)}`)
  );
  const mutations = [...clients].flatMap((client) =>
    client
      .getMutationCache()
      .findAll({ status: 'pending' })
      .map(({ options }) => `mutation ${JSON.stringify(options.mutationKey ?? 'without a key')}`)
  );
  const loads = [...routers]
    .filter(({ state }) => state.status !== 'idle' || state.isLoading)
    .map(({ state }) => `navigation to ${state.location.href}`);
  return [...queries, ...mutations, ...loads];
}

/**
 * Waits for the queries, mutations and navigations the test started, then forgets them: unmounted
 * with one in flight, its answer sets state in a tree that is gone, after jsdom itself may be.
 */
export async function settle(timeout = SETTLE_TIMEOUT_MS): Promise<void> {
  try {
    await vi.waitFor(
      () => {
        const pending = busy();
        if (pending.length > 0) throw new Error(`still running: ${pending.join(', ')}`);
      },
      { timeout }
    );
  } finally {
    clients.clear();
    routers.clear();
  }
}

let ended: string | undefined;

/**
 * From the end of a test until the next starts, a React update throws `LeakedUpdateError` naming
 * the test, in place of the `window is not defined` it raises once jsdom is torn down.
 */
export function trapLeakedUpdates(): void {
  const event = Object.getOwnPropertyDescriptor(window, 'event');
  Object.defineProperty(window, 'event', {
    configurable: true,
    get() {
      // React reads the event for its own scheduler work too; only a state update is the test's.
      if (ended !== undefined && /\brequestUpdateLane\b/.test(new Error().stack ?? '')) {
        throw new LeakedUpdateError(ended);
      }
      return event?.get?.call(window) ?? event?.value;
    },
  });
}

export function endUpdates(test: string): void {
  ended = test;
}

export function startUpdates(): void {
  ended = undefined;
}
