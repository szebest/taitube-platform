import type { ApiClient } from '@vp/api-client';
import type { PlaylistView } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { libraryKeys, playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { queryMutationOptions } from '../api/query-mutation';
import { useListMutation } from './use-list-mutation';

function followPlaylistMutationOptions(api: ApiClient, playlistId: string) {
  const key = playlistQueryOptions(api, playlistId).queryKey;

  return queryMutationOptions({
    key,
    request: (follow: boolean) =>
      follow
        ? api.playlistLibrary.followPlaylist({ params: { id: playlistId } })
        : api.playlistLibrary.unfollowPlaylist({ params: { id: playlistId } }),
    edit: (playlist, following) => ({ ...playlist, viewer: { ...playlist.viewer, following } }),
    invalidate: [libraryKeys.followed()],
  });
}

/** Whether the viewer follows the playlist, as its read says, and the switch. */
export function useFollowPlaylist({ id, viewer }: PlaylistView) {
  const { mutate, isPending } = useListMutation(followPlaylistMutationOptions(useApi(), id));

  return { following: viewer.following, isPending, toggle: () => mutate(!viewer.following) };
}
