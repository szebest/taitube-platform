import { useToast } from '@kit/ui';
import { mutationOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ContractBody, createPlaylistShareLink } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { useT } from '#app/lib/messages';
import { playlistShareLinksQueryOptions } from '../api/playlist-queries';
import { useListMutation } from './use-list-mutation';

type NewShareLink = ContractBody<typeof createPlaylistShareLink>;

function shareLinkMutationOptions<TVariables>(
  api: ApiClient,
  playlistId: string,
  mutationFn: (variables: TVariables) => Promise<unknown>
) {
  return mutationOptions({
    mutationFn,
    onSettled: (_data, _error, _variables, _context, { client }) =>
      client.invalidateQueries({
        queryKey: playlistShareLinksQueryOptions(api, playlistId).queryKey,
      }),
  });
}

/** The owner creates and revokes the links that open this playlist whatever its visibility. */
export function useShareLinkChanges(playlistId: string) {
  const api = useApi();
  const showToast = useToast();
  const { tOr } = useT();
  const params = { id: playlistId };
  const toast = (title: 'playlistTools.linkCreated' | 'playlistTools.linkRevoked') => () =>
    showToast({ tone: 'success', title: tOr(title, {}, '') });

  return {
    create: useListMutation({
      ...shareLinkMutationOptions(api, playlistId, (body: NewShareLink) =>
        api.playlistSharing.createPlaylistShareLink({ params, body })
      ),
      onSuccess: toast('playlistTools.linkCreated'),
    }),
    revoke: useListMutation({
      ...shareLinkMutationOptions(api, playlistId, (linkId: string) =>
        api.playlistSharing.revokePlaylistShareLink({ params: { ...params, linkId } })
      ),
      onSuccess: toast('playlistTools.linkRevoked'),
    }),
  };
}
