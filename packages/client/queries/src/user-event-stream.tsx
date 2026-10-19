import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import type { UserEvent } from '@vp/api-contracts';
import { assertNever } from '@vp/result';
import { useEffect, useEffectEvent } from 'react';

import { useAccount } from './session-provider';
import { applyUserEvent } from './user-event-handlers';
import {
  type UserEventBrowser,
  type UserStreamEvent,
  connectUserEvents,
} from './user-event-source';

type UserEventOf<Type extends UserEvent['type']> = Extract<UserEvent, { type: Type }>;

type UserEventListener = (event: UserEvent) => void;

const listenersByCache = new WeakMap<QueryClient, Set<UserEventListener>>();

function listenersOf(queryClient: QueryClient): Set<UserEventListener> {
  const listeners = listenersByCache.get(queryClient) ?? new Set<UserEventListener>();
  listenersByCache.set(queryClient, listeners);
  return listeners;
}

function isOfType<Type extends UserEvent['type']>(
  event: UserEvent,
  type: Type
): event is UserEventOf<Type> {
  return event.type === type;
}

function receive(queryClient: QueryClient, event: UserStreamEvent): void {
  if (event.type !== 'hello') {
    applyUserEvent(queryClient, event);
    for (const listener of listenersOf(queryClient)) listener(event);
    return;
  }

  switch (event.payload.resume) {
    case 'expired':
      void queryClient.invalidateQueries();
      return;
    case 'fresh':
    case 'replayed':
      return;
    default:
      assertNever(event.payload.resume, 'StreamResume');
  }
}

function browserApis(): UserEventBrowser {
  return {
    locks: navigator.locks,
    openChannel: (name) => new BroadcastChannel(name),
    openSource: (url) => new EventSource(url),
  };
}

/**
 * The signed-in viewer's events, on one connection per browser, fed into this tab's query cache and
 * to `useUserEvent`. Each app root mounts it once; for a guest it opens nothing.
 */
export function UserEventStream() {
  const userId = useAccount()?.id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) {
      return;
    }

    const disconnect = connectUserEvents({
      name: `vp.user-events.${userId}`,
      browser: browserApis(),
      onEvent: (event) => receive(queryClient, event),
    });
    return () => {
      disconnect();
    };
  }, [userId, queryClient]);

  return null;
}

/** Calls `handler` with every event of `type` this tab receives, after its cache work is done. */
export function useUserEvent<Type extends UserEvent['type']>(
  type: Type,
  handler: (payload: UserEventOf<Type>['payload']) => void
): void {
  const queryClient = useQueryClient();
  const onEvent = useEffectEvent((event: UserEvent) => {
    if (!isOfType(event, type)) {
      return;
    }

    handler(event.payload);
  });

  useEffect(() => {
    const listeners = listenersOf(queryClient);
    const listener = (event: UserEvent) => onEvent(event);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [queryClient]);
}
