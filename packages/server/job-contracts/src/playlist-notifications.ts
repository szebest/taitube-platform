import { z } from 'zod';

export const NOTIFY_PLAYLIST_INVITE = 'notify-playlist-invite';
export const NOTIFY_PLAYLIST_UPDATE = 'notify-playlist-update';

export const NotifyPlaylistInviteJob = z.object({
  inviteId: z.uuid(),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type NotifyPlaylistInviteJob = z.infer<typeof NotifyPlaylistInviteJob>;

/** One per playlist and actor per hour: the owner's row groups the rest. */
export const NotifyPlaylistUpdateJob = z.object({
  playlistId: z.uuid(),
  actorUserId: z.uuid(),
  hour: z.string(),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type NotifyPlaylistUpdateJob = z.infer<typeof NotifyPlaylistUpdateJob>;
