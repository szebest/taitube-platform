import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi, useFailureToast } from '@vp/queries';
import { useT } from '#app/lib/messages';
import { inviteCandidatesKey } from './use-invite-candidates';

function invitePersonMutationOptions(
  api: ApiClient,
  roomId: string,
  failed: (error: Error) => void
) {
  return mutationOptions({
    mutationFn: (userId: string) =>
      api.watchPartyInvites.inviteToWatchParty({
        params: { id: roomId },
        body: { userIds: [userId] },
      }),
    onError: failed,
    onSettled: (_result, _error, _userId, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: inviteCandidatesKey(roomId) }),
  });
}

/** Sends the room's invite to one person; the candidate list refetches so the row shows Invited. */
export function useInvitePerson(roomId: string) {
  const api = useApi();
  const { tOr } = useT();
  const showFailure = useFailureToast();

  return useMutation(
    invitePersonMutationOptions(api, roomId, (error) =>
      showFailure(tOr('party.shareInviteFailed', {}, ''), error)
    )
  );
}
