import { Queue } from 'workbox-background-sync';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import { replayQueue } from './replay-queue';
import { isVideoSubresource } from './route-matchers';
import type { SyncMessage } from './sync-messages';

const QUEUE_NAME = 'taitube-sync-v1';
const MAX_RETENTION_MINUTES = 24 * 60;

const QUEUED_CALLS = [
  { method: 'PUT', resource: 'reactions' },
  { method: 'POST', resource: 'comments' },
] as const;

export type SyncChannel = {
  postMessage: (message: SyncMessage) => void;
  addEventListener: (type: 'message', listener: (event: MessageEvent<unknown>) => void) => void;
};

/**
 * Queues a viewer's reaction or comment when the network is gone and replays it once it returns:
 * through the Background Sync API where the browser has it, on the next worker start where not.
 * The page still sees the network error; the queue's size and each replay go out on `channel`.
 * A replay is same-origin, so it keeps the session cookie and the Origin the CSRF check reads.
 */
export function registerBackgroundSync(origin: string, channel: SyncChannel): void {
  const queue = new Queue(QUEUE_NAME, {
    maxRetentionTime: MAX_RETENTION_MINUTES,
    onSync: ({ queue: due }) => replayQueue(due, (message) => channel.postMessage(message), fetch),
  });

  const plugin = {
    fetchDidFail: async ({ request }: { request: Request }) => {
      await queue.pushRequest({ request });
      channel.postMessage({ type: 'pending', pending: await queue.size() });
    },
  };

  for (const { method, resource } of QUEUED_CALLS) {
    registerRoute(
      ({ url }) => isVideoSubresource(url, origin, resource),
      new NetworkOnly({ plugins: [plugin] }),
      method
    );
  }

  channel.addEventListener('message', async ({ data }) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      Reflect.get(data, 'type') === 'status-request'
    ) {
      channel.postMessage({ type: 'pending', pending: await queue.size() });
    }
  });
}
