import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

function upgradeSeatMutationOptions(api: ApiClient, roomId: string) {
  return mutationOptions({
    mutationFn: () => api.watchPartyGuests.upgradeWatchPartySeat({ params: { id: roomId } }),
  });
}

/** Moves a guest's seat to the signed-in account in place: the socket stays open and hears `you`. */
export function useUpgradePartySeat(roomId: string) {
  const api = useApi();

  return useMutation(upgradeSeatMutationOptions(api, roomId));
}
