import { useQuery } from '@tanstack/react-query';
import type { PlaylistView } from '@vp/api-contracts';
import { useAccount, useApi } from '@vp/queries';
import { playlistCollaboratorsQueryOptions } from '../api/playlist-queries';

/**
 * Whether the playlist is worked on by more than its owner, so each item shows who added it: an
 * item someone else added says so, and so does a collaborators list a signed-in reader may see.
 */
export function useHasCollaborators({ id, ownerId, items }: PlaylistView): boolean {
  const api = useApi();
  const account = useAccount();
  const { data } = useQuery({
    ...playlistCollaboratorsQueryOptions(api, id),
    enabled: account !== undefined,
  });

  const addedByOthers = items.some(({ addedBy }) => addedBy !== null && addedBy.userId !== ownerId);
  return addedByOthers || (data?.items.length ?? 0) > 0;
}
