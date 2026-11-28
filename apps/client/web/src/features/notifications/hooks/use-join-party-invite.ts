import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi, watchPartyKeys } from '@vp/queries';

interface InviteTarget {
  roomId: string;
  inviteId: string;
}

function joinPartyInviteMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: ({ roomId, inviteId }: InviteTarget) =>
      api.watchParties.joinWatchParty({ params: { id: roomId }, body: { invite: inviteId } }),
    onSettled: (_data, _error, _target, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: watchPartyKeys.all }),
  });
}

/** Takes the seat an invite grants, past the room's password; the room page shows the answer, a full or closed room included. */
export function useJoinPartyInvite() {
  const api = useApi();

  return useMutation(joinPartyInviteMutationOptions(api));
}
