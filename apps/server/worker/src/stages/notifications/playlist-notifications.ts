import {
  NOTIFY_PLAYLIST_INVITE,
  NOTIFY_PLAYLIST_UPDATE,
  NotifyPlaylistInviteJob,
  NotifyPlaylistUpdateJob,
} from '@vp/job-contracts';
import { consuming } from '../../consuming';
import type { StageProcessor } from '../../stage-processors';
import {
  type NotifyPlaylistInviteDeps,
  createNotifyPlaylistInviteProcessor,
} from './notify-playlist-invite';
import { createNotifyPlaylistUpdateProcessor } from './notify-playlist-update';

/** The notify queue's playlist jobs by name: an invite to the invitee, a change to the owner. */
export function playlistNotifications(
  deps: NotifyPlaylistInviteDeps
): Record<string, StageProcessor> {
  return {
    [NOTIFY_PLAYLIST_INVITE]: consuming(
      NotifyPlaylistInviteJob,
      createNotifyPlaylistInviteProcessor(deps)
    ),
    [NOTIFY_PLAYLIST_UPDATE]: consuming(
      NotifyPlaylistUpdateJob,
      createNotifyPlaylistUpdateProcessor(deps)
    ),
  };
}
