import { mutationOptions, useQuery } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { followedPlaylistIdsQueryOptions } from '../api/playlist-queries';
import { useListMutation } from './use-list-mutation';

function followPlaylistMutationOptions(api: ApiClient, playlistId: string) {
  const ids = followedPlaylistIdsQueryOptions(api).queryKey;

  return mutationOptions({
    mutationFn: (follow: boolean) =>
      follow
        ? api.playlistLibrary.followPlaylist({ params: { id: playlistId } })
        : api.playlistLibrary.unfollowPlaylist({ params: { id: playlistId } }),
    onMutate: async (follow, { client }) => {
      await client.cancelQueries({ queryKey: ids });
      const before = client.getQueryData(ids);
      client.setQueryData(ids, (current = []) =>
        follow ? [...current, playlistId] : current.filter((id) => id !== playlistId)
      );
      return before;
    },
    onError: (_error, _follow, before, { client }) => client.setQueryData(ids, before),
    onSettled: (_data, _error, _follow, _before, { client }) =>
      client.invalidateQueries({ queryKey: libraryKeys.followed() }),
  });
}

/** Whether the viewer follows the playlist, read from every page of what they follow, and the switch. */
export function useFollowPlaylist(playlistId: string, enabled: boolean) {
  const api = useApi();
  const { data: ids = [] } = useQuery({ ...followedPlaylistIdsQueryOptions(api), enabled });
  const { mutate, isPending } = useListMutation(followPlaylistMutationOptions(api, playlistId));

  const following = ids.includes(playlistId);

  return { following, isPending, toggle: () => mutate(!following) };
}
