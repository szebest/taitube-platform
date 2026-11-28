import type { PlaylistView } from '@vp/api-contracts';
import type { PlaylistResource } from '@vp/permissions';
import { useAccount } from '@vp/queries';

/** The playlist as the permission rules see it, with the seat its read gives the viewer. */
export function usePlaylistAccess({
  id,
  ownerId,
  visibility,
  viewer,
}: PlaylistView): PlaylistResource {
  const account = useAccount();
  const collaboratorRole = viewer.role === 'owner' ? null : viewer.role;

  return {
    id,
    ownerId,
    visibility,
    collaboratorId: collaboratorRole === null ? null : (account?.id ?? null),
    collaboratorRole,
  };
}
