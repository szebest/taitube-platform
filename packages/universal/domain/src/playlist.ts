import type { ChannelCard } from './channel';
import { VIDEO_VISIBILITIES, type VideoVisibility } from './status-vocabulary';
import type { Video } from './video';

export const PLAYLIST_VISIBILITIES = VIDEO_VISIBILITIES;

export type PlaylistVisibility = VideoVisibility;

/** Every user owns exactly one system playlist, provisioned with their channel. */
export const WATCH_LATER_TITLE = 'Watch Later';

export interface Playlist {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: PlaylistVisibility;
  isSystem: boolean;
  customThumbnailKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** `position` is the item's 0-based place in the playlist, never its stored sort key. */
export interface PlaylistEntry {
  id: string;
  videoId: string;
  position: number;
  addedAt: Date;
  video: Video;
  channel: ChannelCard | null;
}

export interface PlaylistDetail {
  playlist: Playlist;
  owner: ChannelCard | null;
  items: PlaylistEntry[];
}

export interface OwnedPlaylist extends Playlist {
  videoCount: number;
  containsVideo: boolean;
}

/** How many video posters a playlist card stacks behind its cover. */
export const PLAYLIST_PREVIEW_THUMBNAILS = 3;

export interface PublicPlaylist extends Playlist {
  videoCount: number;
  posterKeys: string[];
}

export interface NewPlaylistInput {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: PlaylistVisibility;
}

export interface PlaylistPatch {
  title?: string;
  description?: string;
  visibility?: PlaylistVisibility;
}

export type PlaylistReorder =
  | { type: 'move'; itemId: string; index: number }
  | { type: 'reindex'; itemIds: readonly string[] };
