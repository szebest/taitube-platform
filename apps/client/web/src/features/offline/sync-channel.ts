import { z } from 'zod';
import { SYNC_CHANNEL, type SyncMessage } from '#app/sw/sync-messages';

const PendingSchema = z.number().int().nonnegative();

const SyncMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status-request') }),
  z.object({ type: z.literal('pending'), pending: PendingSchema }),
  z.object({
    type: z.literal('replayed'),
    pending: PendingSchema,
    videoIds: z.array(z.string()),
  }),
]) satisfies z.ZodType<SyncMessage>;

/**
 * Listens to what the service worker says about its queue of changes, and asks it how many wait
 * right now. Returns the cleanup; where the browser has no BroadcastChannel it does nothing.
 */
export function listenForSync(onMessage: (message: SyncMessage) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') {
    return () => {};
  }

  const channel = new BroadcastChannel(SYNC_CHANNEL);
  channel.addEventListener('message', ({ data }: MessageEvent<unknown>) => {
    const parsed = SyncMessageSchema.safeParse(data);
    if (parsed.success) {
      onMessage(parsed.data);
    }
  });
  channel.postMessage({ type: 'status-request' } satisfies SyncMessage);

  return () => channel.close();
}
