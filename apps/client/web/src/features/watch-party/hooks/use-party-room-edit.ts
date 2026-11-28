import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

export interface PartyRoomEdit {
  /** The room version the edit is based on. */
  version: number;
  accent?: string | null;
}

function roomEditOptions(api: ApiClient, roomId: string) {
  return mutationOptions({
    mutationFn: async (edit: PartyRoomEdit): Promise<void> => {
      await api.watchParties.updateWatchParty({ params: { id: roomId }, body: edit });
    },
  });
}

/** What the room's settings holder changes: the sockets send the new settings, so nothing is invalidated. */
export function usePartyRoomEdit(roomId: string) {
  const api = useApi();

  return useMutation(roomEditOptions(api, roomId));
}
