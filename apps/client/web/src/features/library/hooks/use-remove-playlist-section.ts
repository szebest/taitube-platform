import { useToast } from '@kit/ui';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';
import { useT } from '#app/lib/messages';
import { libraryKeys, playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { queryMutationOptions } from '../api/query-mutation';
import { useListMutation } from './use-list-mutation';

function removeSectionMutationOptions(api: ApiClient, playlistId: string) {
  return queryMutationOptions({
    key: playlistQueryOptions(api, playlistId).queryKey,
    request: (sectionId: string) =>
      api.playlistItems.removePlaylistSection({ params: { id: playlistId, itemId: sectionId } }),
    edit: (playlist, sectionId) => ({
      ...playlist,
      sections: playlist.sections.filter(({ id }) => id !== sectionId),
    }),
    invalidate: [libraryKeys.playlist(playlistId)],
  });
}

/**
 * Removes a section; the videos under it stay where they are. The toast lives here because the
 * optimistic edit unmounts the row that asked.
 */
export function useRemovePlaylistSection(playlistId: string) {
  const api = useApi();
  const showToast = useToast();
  const { tOr } = useT();

  return useListMutation({
    ...removeSectionMutationOptions(api, playlistId),
    onSuccess: () =>
      showToast({ tone: 'success', title: tOr('playlistEdit.sectionRemoved', {}, '') }),
  });
}
