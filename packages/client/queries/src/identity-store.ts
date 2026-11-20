import { isOk, parseJson } from '@kit/result';
import type { QueryClient } from '@tanstack/react-query';
import { AccountSlotSchema } from '@vp/api-contracts';
import { z } from 'zod';
import { identityKey } from './account-slots';
import { createQueryClient } from './create-query-client';

/** How long a row's prepared cache counts as fresh: hovering it again within this asks nothing. */
const PREPARE_INTERVAL_MS = 5000;

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
  /** Acts as `next` from now on, with a cache of its own: the one `prepare` filled for it, if any. */
  switchTo: (next: IdentityState) => QueryClient;
  /**
   * A cache for `next` to fill before a switch to it, so the switch lands on warm data; `undefined`
   * when one was handed out for it in the last 5 seconds.
   */
  prepare: (next: IdentityState, now?: number) => QueryClient | undefined;
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
  const prepared = new Map<string, { client: QueryClient; at: number }>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const freshCache = (): QueryClient => {
    const client = createQueryClient();
    client.setDefaultOptions(current.getDefaultOptions());
    return client;
  };

  const replaceCache = (next?: IdentityState): QueryClient => {
    const dropped = current;
    const warm = next && prepared.get(identityKey(next.identity))?.client;
    current = warm ?? freshCache();
    for (const { client } of prepared.values()) {
      if (client !== current) void client.cancelQueries();
    }
    prepared.clear();
    void dropped.cancelQueries();
    return current;
  };

  return {
    read: () => state,
    key: () => identityKey(state.identity),
    queryClient: () => current,
    switchTo: (next) => {
      const switched = replaceCache(next);
      state = next;
      notify();
      return switched;
    },
    prepare: (next, now = Date.now()) => {
      const key = identityKey(next.identity);
      const held = prepared.get(key);
      if (held && now - held.at < PREPARE_INTERVAL_MS) return undefined;
      const client = held?.client ?? freshCache();
      prepared.set(key, { client, at: now });
      return client;
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
