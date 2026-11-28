import { assertNever } from '@kit/result';
import { mutationOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useListMutation } from './use-list-mutation';

/** Into a playlist the viewer may add to, or into a new one of theirs by its title. */
type PlaylistMerge = { sourceIds: readonly string[]; deleteSources: boolean } & (
  | { kind: 'into'; into: string }
  | { kind: 'new'; newTitle: string }
);

function targetOf(merge: PlaylistMerge) {
  switch (merge.kind) {
    case 'into':
      return { into: merge.into };
    case 'new':
      return { newTitle: merge.newTitle };
    default:
      return assertNever(merge, 'PlaylistMerge');
  }
}

function mergeMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: (merge: PlaylistMerge) =>
      api.playlistTransfer.mergePlaylists({
        body: {
          sourceIds: [...merge.sourceIds],
          deleteSources: merge.deleteSources,
          ...targetOf(merge),
        },
      }),
    onSettled: (_result, _error, _merge, _snapshot, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: libraryKeys.playlistDetails() }),
        client.invalidateQueries({ queryKey: libraryKeys.playlists() }),
      ]),
  });
}

/** Copies the items of up to five playlists, in order, into one; the answer reports each item. */
export function useMergePlaylists() {
  const api = useApi();
  return useListMutation(mergeMutationOptions(api));
}
