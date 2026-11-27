import { useToast } from '@kit/ui';
import { mutationOptions, useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';
import { useT } from '#app/lib/messages';
import { libraryKeys } from '#app/lib/query-keys/library-keys';

type InviteAnswer = 'accept' | 'decline';

function answerInviteMutationOptions(api: ApiClient, token: string) {
  return mutationOptions({
    mutationFn: async (answer: InviteAnswer) => {
      if (answer === 'decline') {
        await api.playlistCollaboration.declinePlaylistInvite({ params: { token } });
        return null;
      }
      return api.playlistCollaboration.acceptPlaylistInvite({ params: { token } });
    },
    onSettled: (_joined, _error, _answer, _context, { client }) =>
      client.invalidateQueries({ queryKey: libraryKeys.all }),
  });
}

/**
 * Accepting opens the playlist the invite seats the viewer on; declining goes home. A dead invite
 * stays on the mutation's error for the page to show.
 */
export function useAnswerPlaylistInvite(token: string) {
  const navigate = useNavigate();
  const showToast = useToast();
  const { tOr } = useT();

  return useMutation({
    ...answerInviteMutationOptions(useApi(), token),
    onSuccess: (joined) => {
      if (joined === null) {
        showToast({ tone: 'success', title: tOr('playlistPeople.declined', {}, '') });
        return navigate({ to: '/' });
      }

      showToast({ tone: 'success', title: tOr('playlistPeople.joined', {}, '') });
      return navigate({ to: '/playlist', search: { list: joined.playlistId } });
    },
  });
}
