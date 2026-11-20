import { isOk, parseJson } from '@kit/result';
import type { QueryClient } from '@tanstack/react-query';
import { AccountSlotSchema } from '@vp/api-contracts';
import { z } from 'zod';
import { identityKey } from './account-slots';
import { createQueryClient } from './create-query-client';

const IdentityStateSchema = z.object({
  identity: z.object({ slot: AccountSlotSchema, channel: z.string().optional() }),
  /** Whether links carry the identity's prefix: from a second account, or a channel, on. */
  prefixed: z.boolean(),
});

export type IdentityState = z.infer<typeof IdentityStateSchema>;

/** The state the server dehydrated into the page, or `undefined` for anything else. */
export function parseIdentityState(raw: string | undefined): IdentityState | undefined {
  if (raw === undefined) return undefined;
  const json = parseJson(raw);
  const parsed = isOk(json) ? IdentityStateSchema.safeParse(json.value) : undefined;
  return parsed?.success ? parsed.data : undefined;
}

/**
 * The identity a router acts as, and the one query cache that belongs to it. A switch builds the
 * next identity's cache and drops the last one, cancelling what it was loading, so a response in
 * flight for the old identity lands in a cache nobody reads; nothing is cleared under a reader.
 */
export type IdentityStore = {
  read: () => IdentityState;
  key: () => string;
  queryClient: () => QueryClient;
  /** Acts as `next` from now on, with a cache of its own. */
  switchTo: (next: IdentityState) => QueryClient;
  /** The same identity with an empty cache, after its account signed in or out. */
  renew: () => QueryClient;
  /** What the server resolved, kept as the browser hydrates; the cache stays the one it filled. */
  hydrate: (state: IdentityState) => void;
  /** Links carry the prefix from now on, because a second account signed in elsewhere. */
  markPrefixed: () => void;
  subscribe: (onChange: () => void) => () => void;
};

export function createIdentityStore(
  initial: IdentityState,
  queryClient: QueryClient = createQueryClient()
): IdentityStore {
  let state = initial;
  let current = queryClient;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const replaceCache = (): QueryClient => {
    const dropped = current;
    current = createQueryClient();
    current.setDefaultOptions(dropped.getDefaultOptions());
    void dropped.cancelQueries();
    return current;
  };

  return {
    read: () => state,
    key: () => identityKey(state.identity),
    queryClient: () => current,
    switchTo: (next) => {
      state = next;
      const switched = replaceCache();
      notify();
      return switched;
    },
    renew: () => {
      const renewed = replaceCache();
      notify();
      return renewed;
    },
    hydrate: (hydrated) => {
      state = hydrated;
      notify();
    },
    markPrefixed: () => {
      state = { ...state, prefixed: true };
      notify();
    },
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
}
