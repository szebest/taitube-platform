import { useToast } from '@kit/ui';
import { mutationOptions, useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { ApiClient } from '@vp/api-client';
import type { ContractBody, createPlaylistInviteLink } from '@vp/api-contracts';
import type { PlaylistCollaboratorRole } from '@vp/domain';
import { useApi } from '@vp/queries';
import { useT } from '#app/lib/messages';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useListMutation } from './use-list-mutation';

type InviteLink = ContractBody<typeof createPlaylistInviteLink>;

interface Seat {
  userId: string;
  role: PlaylistCollaboratorRole;
}

/** Every seat change goes stale beside the playlist, so the list, the invites and the activity refetch. */
function seatMutationOptions<TData, TVariables>(
  playlistId: string,
  mutationFn: (variables: TVariables) => Promise<TData>
) {
  return mutationOptions({
    mutationFn,
    onSettled: (_data, _error, _variables, _context, { client }) =>
      client.invalidateQueries({ queryKey: libraryKeys.playlist(playlistId) }),
  });
}

function collaboratorMutationOptions(api: ApiClient, playlistId: string) {
  const params = { id: playlistId };

  return {
    changeRole: seatMutationOptions(playlistId, ({ userId, role }: Seat) =>
      api.playlistCollaboration.changePlaylistCollaboratorRole({
        params: { ...params, userId },
        body: { role },
      })
    ),
    remove: seatMutationOptions(playlistId, (userId: string) =>
      api.playlistCollaboration.removePlaylistCollaborator({ params: { ...params, userId } })
    ),
    invite: seatMutationOptions(
      playlistId,
      (body: { handle: string; role: PlaylistCollaboratorRole }) =>
        api.playlistCollaboration.invitePlaylistCollaborator({ params, body })
    ),
    createLink: seatMutationOptions(playlistId, (body: InviteLink) =>
      api.playlistCollaboration.createPlaylistInviteLink({ params, body })
    ),
    revoke: seatMutationOptions(playlistId, (inviteId: string) =>
      api.playlistCollaboration.revokePlaylistInvite({ params: { ...params, inviteId } })
    ),
    leave: seatMutationOptions(playlistId, () =>
      api.playlistCollaboration.leavePlaylist({ params })
    ),
  };
}

/**
 * The owner's changes to who works on the playlist. A role change, a removal and a revoke toast a
 * refusal; an invite and a link keep theirs for the form to show beside its fields.
 */
export function useCollaboratorChanges(playlistId: string) {
  const options = collaboratorMutationOptions(useApi(), playlistId);

  return {
    changeRole: useListMutation(options.changeRole),
    remove: useListMutation(options.remove),
    revoke: useListMutation(options.revoke),
    invite: useMutation(options.invite),
    createLink: useMutation(options.createLink),
  };
}

/** A collaborator gives up their seat and goes back to the playlist as a reader, or out of it. */
export function useLeavePlaylist(playlistId: string, title: string) {
  const navigate = useNavigate();
  const showToast = useToast();
  const { tOr } = useT();

  return useListMutation({
    ...collaboratorMutationOptions(useApi(), playlistId).leave,
    onSuccess: () => {
      showToast({ tone: 'success', title: tOr('playlistPeople.left', { title }, '') });
      return navigate({ to: '/feed/playlists' });
    },
  });
}
