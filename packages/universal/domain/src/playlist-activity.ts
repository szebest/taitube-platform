import { MS_PER_MINUTE } from '@kit/primitives';
import type { PlaylistCollaboratorRole } from './playlist-collaboration';

export const PLAYLIST_ACTIVITY_ACTIONS = [
  'item_added',
  'item_removed',
  'items_reordered',
  'note_edited',
  'section_added',
  'collaborator_added',
  'collaborator_removed',
  'role_changed',
  'settings_changed',
  'auto_removed',
  'restored',
] as const;
export type PlaylistActivityAction = (typeof PLAYLIST_ACTIVITY_ACTIONS)[number];

export const PLAYLIST_ACTIVITY_RETENTION_DAYS = 180;
const PLAYLIST_REORDER_COALESCE_MS = 5 * MS_PER_MINUTE;

/** A removed item or section as it stood, so the owner can put it back from the log. */
export interface RemovedPlaylistItem {
  readonly itemId: string;
  readonly videoId: string | null;
  readonly title: string | null;
  readonly addedBy: string | null;
  readonly note: string | null;
  readonly startMs: number | null;
  readonly endMs: number | null;
}

/** What an activity row points at, tagged by the action that wrote it. */
export type PlaylistActivityEntry =
  | { action: 'item_added'; target: { itemId: string; videoId: string } }
  | { action: 'item_removed'; target: RemovedPlaylistItem }
  | { action: 'auto_removed'; target: RemovedPlaylistItem }
  | { action: 'items_reordered'; target: { count: number } }
  | { action: 'note_edited'; target: { itemId: string } }
  | { action: 'section_added'; target: { itemId: string; title: string } }
  | { action: 'collaborator_added'; target: { userId: string; role: PlaylistCollaboratorRole } }
  | { action: 'collaborator_removed'; target: { userId: string } }
  | { action: 'role_changed'; target: { userId: string; role: PlaylistCollaboratorRole } }
  | { action: 'settings_changed'; target: { fields: string[] } }
  | { action: 'restored'; target: { activityId: string; itemId: string } };

export type PlaylistActivity = PlaylistActivityEntry & {
  readonly id: string;
  readonly playlistId: string;
  readonly actorUserId: string | null;
  readonly createdAt: Date;
};

export type NewPlaylistActivity = PlaylistActivityEntry & {
  readonly id: string;
  readonly playlistId: string;
  readonly actorUserId: string;
};

/**
 * A reorder by the same person within five minutes of their last one is the same edit: the newest
 * row absorbs it instead of a second row.
 */
export function coalescesWith(
  latest: Pick<PlaylistActivity, 'action' | 'actorUserId' | 'createdAt'> | null,
  next: Pick<NewPlaylistActivity, 'action' | 'actorUserId'>,
  now: Date
): boolean {
  return (
    latest !== null &&
    next.action === 'items_reordered' &&
    latest.action === 'items_reordered' &&
    latest.actorUserId === next.actorUserId &&
    now.getTime() - latest.createdAt.getTime() <= PLAYLIST_REORDER_COALESCE_MS
  );
}

export type RestorablePlaylistActivity = Extract<
  PlaylistActivity,
  { action: 'item_removed' | 'auto_removed' }
>;

export function isRestorable(activity: PlaylistActivity): activity is RestorablePlaylistActivity {
  return activity.action === 'item_removed' || activity.action === 'auto_removed';
}
