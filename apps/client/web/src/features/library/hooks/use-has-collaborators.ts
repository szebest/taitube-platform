import { useQuery } from '@tanstack/react-query';
import type { PlaylistView } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { playlistCollaboratorsQueryOptions } from '../api/playlist-queries';

/**
 * Whether the playlist is worked on by more than its owner, so each item shows who added it: an
 * item someone else added says so, and so does the collaborators list, which only the owner and the
 * collaborators may read.
 */
export function useHasCollaborators({ id, ownerId, items, viewer }: PlaylistView): boolean {
  const { data } = useQuery({
    ...playlistCollaboratorsQueryOptions(useApi(), id),
    enabled: viewer.role !== null,
  });

  const addedByOthers = items.some(({ addedBy }) => addedBy !== null && addedBy.userId !== ownerId);
  return addedByOthers || (data?.items.length ?? 0) > 0;
}
