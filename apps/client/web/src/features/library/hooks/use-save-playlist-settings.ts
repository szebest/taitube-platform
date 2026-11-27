import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ContractBody, updatePlaylist } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { libraryKeys, playlistQueryOptions } from '#app/lib/query-keys/library-keys';

export type PlaylistSettings = Pick<
  ContractBody<typeof updatePlaylist>,
  'autoRemoveWatched' | 'coverMode' | 'coverVideoId' | 'coverUploadId' | 'rules'
>;

function savePlaylistSettingsMutationOptions(api: ApiClient, playlistId: string) {
  return mutationOptions({
    mutationFn: (settings: PlaylistSettings) =>
      api.playlists.updatePlaylist({ params: { id: playlistId }, body: settings }),
    onSuccess: (playlist, _settings, _context, { client }) => {
      client.setQueryData(playlistQueryOptions(api, playlistId).queryKey, playlist);
      return client.invalidateQueries({ queryKey: libraryKeys.playlists() });
    },
  });
}

/**
 * The owner's settings and a smart playlist's rules, answered with the playlist as it now stands.
 * The caller shows a refusal where it was made, beside the setting.
 */
export function useSavePlaylistSettings(playlistId: string) {
  return useMutation(savePlaylistSettingsMutationOptions(useApi(), playlistId));
}
