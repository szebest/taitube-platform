import { useRouter } from '@tanstack/react-router';
import { useApi } from '@vp/queries';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useListMutation } from './use-list-mutation';

/** Deletes a playlist and leaves its page for the list of playlists. */
export function useDeletePlaylist() {
  const api = useApi();
  const router = useRouter();

  return useListMutation({
    mutationFn: (playlistId: string) =>
      api.playlists.deletePlaylist({ params: { id: playlistId } }),
    onSuccess: async (_result, playlistId, _snapshot, { client }) => {
      await router.navigate({ to: '/feed/playlists', replace: true });
      client.removeQueries({ queryKey: libraryKeys.playlist(playlistId) });
      await client.invalidateQueries({ queryKey: libraryKeys.playlists() });
    },
  });
}
