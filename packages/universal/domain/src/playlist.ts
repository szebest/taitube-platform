import type { ChannelCard } from './channel';
import { VIDEO_VISIBILITIES, type VideoVisibility } from './status-vocabulary';
import type { Video } from './video';

export const PLAYLIST_VISIBILITIES = VIDEO_VISIBILITIES;

export type PlaylistVisibility = VideoVisibility;

export const PLAYLIST_KINDS = ['playlist', 'series'] as const;

export type PlaylistKind = (typeof PLAYLIST_KINDS)[number];

/** A series episode counts as watched once this share of it has played. */
export const SERIES_EPISODE_DONE_PERCENT = 92;

export const DEFAULT_PLAYLIST_VISIBILITY: PlaylistVisibility = 'private';

export const PLAYLIST_ITEM_KINDS = ['video', 'section'] as const;
export type PlaylistItemKind = (typeof PLAYLIST_ITEM_KINDS)[number];

export const PLAYLIST_COVER_MODES = ['auto', 'item', 'custom'] as const;
export type PlaylistCoverMode = (typeof PLAYLIST_COVER_MODES)[number];

/** A segment is at least this long, so a range never collapses to a point. */
export const PLAYLIST_SEGMENT_MIN_MS = 1000;

export const PLAYLIST_ITEM_SORTS = ['manual', 'added', 'duration', 'channel', 'unwatched_first'] as const;
export type PlaylistItemSort = (typeof PLAYLIST_ITEM_SORTS)[number];

export const PLAYLIST_TRANSFER_MAX_ITEMS = 100;
export const PLAYLIST_MERGE_MAX_SOURCES = 5;
export const PLAYLIST_IMPORT_MAX_LINES = 500;
export const PLAYLIST_IMPORT_MAX_BYTES = 1024 * 1024;

/** Every user owns exactly one system playlist, provisioned with their channel. */
export const WATCH_LATER_TITLE = 'Watch Later';

export interface Playlist {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: PlaylistVisibility;
  kind: PlaylistKind;
  isSystem: boolean;
  customThumbnailKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Who put an item in, with the channel the list shows as their avatar. */
export interface PlaylistItemAdder {
  userId: string;
  channel: ChannelCard | null;
}

/** The range of a video an item plays; either end open. */
export interface PlaylistSegment {
  startMs: number | null;
  endMs: number | null;
}

/**
 * `position` is the item's 0-based place in the playlist, sections counted, never its stored sort
 * key.
 */
export interface PlaylistEntry extends PlaylistSegment {
  id: string;
  videoId: string;
  position: number;
  addedAt: Date;
  addedBy: PlaylistItemAdder | null;
  note: string | null;
  video: Video;
  channel: ChannelCard | null;
}

/** An item row as stored, a video or a section, for the decisions about one item. */
export interface StoredPlaylistItem extends PlaylistSegment {
  id: string;
  kind: PlaylistItemKind;
  videoId: string | null;
  title: string | null;
  addedBy: string | null;
  note: string | null;
  position: number;
}

export interface PlaylistItemPatch {
  note?: string | null;
  startMs?: number | null;
  endMs?: number | null;
  title?: string;
}

/** A divider between items: it holds no video and is never counted. */
export interface PlaylistSection {
  id: string;
  title: string;
  position: number;
  addedBy: string | null;
}

export interface PlaylistDetail {
  playlist: Playlist;
  owner: ChannelCard | null;
  items: PlaylistEntry[];
  sections: PlaylistSection[];
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
  kind?: PlaylistKind;
}

export interface PlaylistPatch {
  title?: string;
  description?: string;
  visibility?: PlaylistVisibility;
  kind?: PlaylistKind;
}

export type PlaylistReorder =
  | { type: 'move'; itemId: string; index: number }
  | { type: 'reindex'; itemIds: readonly string[] };
