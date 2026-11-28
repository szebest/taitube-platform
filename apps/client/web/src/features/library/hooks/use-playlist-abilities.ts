import type { PlaylistView } from '@vp/api-contracts';
import {
  canDeletePlaylist,
  canFollowPlaylist,
  canManagePlaylistCollaborators,
  canPinPlaylist,
  canReadPlaylistActivity,
  canReadPlaylistStats,
  canRestorePlaylistItem,
  canUpdatePlaylist,
} from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { usePlaylistAccess } from './use-playlist-access';

/** What the viewer may do with the playlist beyond reading it, each from its rule over their seat. */
export function usePlaylistAbilities(playlist: PlaylistView) {
  const access = usePlaylistAccess(playlist);
  const check = { playlist: access };
  const canReadActivity = useCan(canReadPlaylistActivity, check);
  const canManageCollaborators = useCan(canManagePlaylistCollaborators, check);

  return {
    follow: useCan(canFollowPlaylist, check),
    pin: useCan(canPinPlaylist, check),
    seeCollaborators: canReadActivity,
    manageCollaborators: canManageCollaborators,
    leave: canReadActivity && !canManageCollaborators,
    readActivity: canReadActivity,
    restore: useCan(canRestorePlaylistItem, check),
    readStats: useCan(canReadPlaylistStats, { stats: { ownerId: playlist.ownerId } }),
    share: useCan(canUpdatePlaylist, { ...check, field: 'visibility' }),
    configure: useCan(canUpdatePlaylist, { ...check, field: 'autoRemoveWatched' }),
    editRules: useCan(canUpdatePlaylist, { ...check, field: 'rules' }),
    delete: useCan(canDeletePlaylist, check),
  };
}

export type PlaylistAbilities = ReturnType<typeof usePlaylistAbilities>;
