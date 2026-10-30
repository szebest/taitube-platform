import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import type { UserEvent } from '@vp/api-contracts';
import { assertNever } from '@vp/result';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
} from 'react';

import { useAccount } from './session-provider';
import { applyUserEvent, setUnreadCount } from './user-event-handlers';
import {
  connectUserEvents,
  type UserEventBrowser,
  type UserStreamEvent,
} from './user-event-source';
import { videoKeys } from './video-queries';

type UserEventOf<Type extends UserEvent['type']> = Extract<UserEvent, { type: Type }>;

type UserEventListener = (event: UserEvent) => void;

const UserEventListeners = createContext<Set<UserEventListener> | undefined>(undefined);

function isOfType<Type extends UserEvent['type']>(
  event: UserEvent,
  type: Type
): event is UserEventOf<Type> {
  return event.type === type;
}

function refetchVideos(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: videoKeys.all, refetchType: 'active' });
}

function receive(
  queryClient: QueryClient,
  listeners: Set<UserEventListener>,
  event: UserStreamEvent
): void {
  if (event.type !== 'hello') {
    applyUserEvent(queryClient, event);
    for (const listener of listeners) listener(event);
    return;
  }

  setUnreadCount(queryClient, event.payload.unreadNotifications);
  switch (event.payload.resume) {
    case 'expired':
      void queryClient.invalidateQueries();
      return;
    case 'fresh':
      refetchVideos(queryClient);
      return;
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
 * to `useUserEvent` below it. Each app root mounts it once around the shell; for a guest it opens
 * nothing.
 */
export function UserEventStream({ children }: PropsWithChildren) {
  const [listeners] = useState(() => new Set<UserEventListener>());
  const userId = useAccount()?.id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) {
      return;
    }

    const disconnect = connectUserEvents({
      name: `vp.user-events.${userId}`,
      browser: browserApis(),
      onEvent: (event) => receive(queryClient, listeners, event),
      onFollow: () => refetchVideos(queryClient),
    });
    return () => {
      disconnect();
    };
  }, [userId, queryClient, listeners]);

  return <UserEventListeners value={listeners}>{children}</UserEventListeners>;
}

/** Calls `handler` with every event of `type` this tab receives, after its cache work is done. */
export function useUserEvent<Type extends UserEvent['type']>(
  type: Type,
  handler: (event: UserEventOf<Type>) => void
): void {
  const listeners = useContext(UserEventListeners);
  if (!listeners) {
    throw new Error('useUserEvent must be used within UserEventStream');
  }
  const onEvent = useEffectEvent((event: UserEvent) => {
    if (!isOfType(event, type)) {
      return;
    }

    handler(event);
  });

  useEffect(() => {
    const listener = (event: UserEvent) => onEvent(event);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [listeners]);
}
