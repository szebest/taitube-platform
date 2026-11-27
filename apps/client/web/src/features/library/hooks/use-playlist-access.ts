import { useQuery } from '@tanstack/react-query';
import type { PlaylistView } from '@vp/api-contracts';
import type { PlaylistResource } from '@vp/permissions';
import { useAccount, useApi } from '@vp/queries';
import { playlistCollaboratorsQueryOptions } from '../api/playlist-queries';

/**
 * The playlist as the permission rules see it, with the viewer's own seat on it. The read carries no
 * seat, so a signed-in reader other than the owner asks for the collaborators; a stranger is refused
 * that list, which means no seat.
 */
export function usePlaylistAccess({ id, ownerId, visibility }: PlaylistView): PlaylistResource {
  const api = useApi();
  const account = useAccount();
  const { data } = useQuery({
    ...playlistCollaboratorsQueryOptions(api, id),
    enabled: account !== undefined && account.id !== ownerId,
  });
  const seat = data?.items.find(({ userId }) => userId === account?.id);

  return {
    id,
    ownerId,
    visibility,
    collaboratorId: seat?.userId ?? null,
    collaboratorRole: seat?.role ?? null,
  };
}
