import { fromPromise } from '@vp/result';
import type { Queue } from 'workbox-background-sync';
import type { SyncMessage } from './sync-messages';

export type ReplayQueue = Pick<Queue, 'shiftRequest' | 'unshiftRequest' | 'size'>;

const VIDEO_PATH = /\/videos\/([^/]+)\//;

/**
 * Sends the queued calls in order. A call the server answered, a 4xx included (a 401 means the
 * viewer signed out), is settled and dropped; a network error or a 5xx puts it back and rejects,
 * which is how the browser is told to try again later.
 */
export async function replayQueue(
  queue: ReplayQueue,
  report: (message: SyncMessage) => void,
  send: typeof fetch
): Promise<void> {
  const videoIds: string[] = [];

  for (let entry = await queue.shiftRequest(); entry; entry = await queue.shiftRequest()) {
    const sent = await fromPromise(send(entry.request.clone()), (cause) => cause);
    if (!sent.ok || sent.value.status >= 500) {
      await queue.unshiftRequest(entry);
      report({ type: 'replayed', pending: await queue.size(), videoIds });
      throw new Error('Replay incomplete');
    }
    const videoId = VIDEO_PATH.exec(entry.request.url)?.[1];
    if (videoId && !videoIds.includes(videoId)) {
      videoIds.push(videoId);
    }
  }

  report({ type: 'replayed', pending: 0, videoIds });
}
