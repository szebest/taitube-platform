import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi, watchPartyKeys } from '@vp/queries';

interface JoinPartyVariables {
  password?: string;
  invite?: string;
}

function joinPartyMutationOptions(api: ApiClient, roomId: string) {
  return mutationOptions({
    mutationFn: ({ password, invite }: JoinPartyVariables) =>
      api.watchParties.joinWatchParty({ params: { id: roomId }, body: { password, invite } }),
    onSuccess: (_membership, _variables, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: watchPartyKeys.all }),
  });
}

/** Takes a seat as the signed-in viewer, with the room's password or an invite when it needs one. */
export function useJoinParty(roomId: string) {
  const api = useApi();

  return useMutation(joinPartyMutationOptions(api, roomId));
}
