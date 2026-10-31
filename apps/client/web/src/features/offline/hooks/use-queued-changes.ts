import { useState, useSyncExternalStore } from 'react';
import { listenForSync } from '../sync-channel';

interface PendingStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => number;
}

function createPendingStore(): PendingStore {
  let pending = 0;
  return {
    subscribe: (onChange) =>
      listenForSync((message) => {
        if (
          (message.type !== 'pending' && message.type !== 'replayed') ||
          message.pending === pending
        ) {
          return;
        }
        pending = message.pending;
        onChange();
      }),
    getSnapshot: () => pending,
  };
}

const serverSnapshot = () => 0;

/** How many changes the service worker holds until the connection returns; the server renders none. */
export function useQueuedChanges(): number {
  const [store] = useState(createPendingStore);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);
}
