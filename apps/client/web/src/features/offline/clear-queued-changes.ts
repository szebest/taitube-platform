import { SYNC_CHANNEL, type SyncMessage } from '#app/sw/sync-messages';

/**
 * Tells the service worker to drop the changes it holds for replay. Called as a viewer signs out:
 * a replay carries whichever session exists when it runs, so what one viewer queued must not be
 * sent as the next one. Does nothing where the browser has no BroadcastChannel.
 */
export function clearQueuedChanges(): void {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }
  const channel = new BroadcastChannel(SYNC_CHANNEL);
  channel.postMessage({ type: 'clear-queue' } satisfies SyncMessage);
  channel.close();
}
