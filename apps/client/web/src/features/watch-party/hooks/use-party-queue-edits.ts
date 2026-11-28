import { assertNever } from '@kit/result';
import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

export type PartyQueueEdit =
  | { type: 'add'; videoId: string }
  | { type: 'remove'; itemId: string }
  | { type: 'move'; itemId: string; toIndex: number };

function queueEditOptions(api: ApiClient, roomId: string) {
  return mutationOptions({
    mutationFn: async (edit: PartyQueueEdit): Promise<void> => {
      const params = { id: roomId };
      switch (edit.type) {
        case 'add':
          await api.watchPartyQueue.addToWatchPartyQueue({
            params,
            body: { videoId: edit.videoId },
          });
          break;
        case 'remove':
          await api.watchPartyQueue.removeWatchPartyQueueItem({
            params: { ...params, itemId: edit.itemId },
          });
          break;
        case 'move':
          await api.watchPartyQueue.moveWatchPartyQueueItem({
            params: { ...params, itemId: edit.itemId },
            body: { toIndex: edit.toIndex },
          });
          break;
        default:
          return assertNever(edit, 'PartyQueueEdit');
      }
    },
  });
}

/** What a member does to the shared queue: the room's sockets send the new queue, so nothing is invalidated. */
export function usePartyQueueEdits(roomId: string) {
  const api = useApi();

  return useMutation(queueEditOptions(api, roomId));
}
