import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi, watchPartyKeys } from '@vp/queries';

function joinAsGuestMutationOptions(api: ApiClient, roomId: string) {
  return mutationOptions({
    mutationFn: (invite?: string) =>
      api.watchPartyGuests.joinWatchPartyAsGuest({ params: { id: roomId }, body: { invite } }),
    onSuccess: (_guest, _invite, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: watchPartyKeys.all }),
  });
}

/** Takes a guest seat: the API sets the party-guest cookie and the seat in one step. */
export function useJoinPartyAsGuest(roomId: string) {
  const api = useApi();

  return useMutation(joinAsGuestMutationOptions(api, roomId));
}
