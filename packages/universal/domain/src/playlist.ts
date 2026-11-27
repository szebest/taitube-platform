import type { ChannelCard } from './channel';
import type { PlaylistViewerState } from './playlist-collaboration';
import type { SmartPlaylistRules } from './smart-playlist';
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

export const PLAYLIST_ITEM_SORTS = [
  'manual',
  'added',
  'duration',
  'channel',
  'unwatched_first',
] as const;
export type PlaylistItemSort = (typeof PLAYLIST_ITEM_SORTS)[number];

/**
 * `unwatched_first` sorts on one scalar: the watched flag above the position, which an int column
 * keeps inside 32 bits, so both adapters compare the very value a cursor carries.
 */
export const PLAYLIST_WATCHED_SORT_SHIFT = 2 ** 32;
export const PLAYLIST_POSITION_SORT_OFFSET = 2 ** 31;

export function unwatchedFirstKey(watched: boolean, position: number): number {
  return (watched ? PLAYLIST_WATCHED_SORT_SHIFT : 0) + position + PLAYLIST_POSITION_SORT_OFFSET;
}

export const PLAYLIST_TRANSFER_MAX_ITEMS = 100;
export const PLAYLIST_MERGE_MAX_SOURCES = 5;
export const PLAYLIST_IMPORT_MAX_LINES = 500;
export const PLAYLIST_IMPORT_MAX_BYTES = 1024 * 1024;

/** How many playlists one user may pin as shelves of their library. */
export const PLAYLIST_PIN_LIMIT = 5;

/** An `auto` cover is a mosaic of this many of the first thumbnails, drawn at render. */
export const PLAYLIST_COVER_MOSAIC_SIZE = 4;

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
  /** Set on a smart playlist, which stores no items and computes them on read. */
  rules: SmartPlaylistRules | null;
  autoRemoveWatched: boolean;
  pinnedAt: Date | null;
  forkedFromPlaylistId: string | null;
  coverMode: PlaylistCoverMode;
  coverVideoId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** What a playlist starts with beside its own words, as the columns default it. */
export const DEFAULT_PLAYLIST_SETTINGS = {
  rules: null,
  autoRemoveWatched: false,
  pinnedAt: null,
  forkedFromPlaylistId: null,
  coverMode: 'auto',
  coverVideoId: null,
} as const satisfies Partial<Playlist>;

/** Who put an item in, with the channel the list shows as their avatar. */
interface PlaylistItemAdder {
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

/**
 * A segment as the video now stands: an end past a replaced, shorter video is dropped, and a start
 * past it too, so the item plays from the beginning rather than not at all.
 */
export function clampSegment(segment: PlaylistSegment, durationMs: number): PlaylistSegment {
  const endMs = segment.endMs !== null && segment.endMs < durationMs ? segment.endMs : null;
  const startMs = segment.startMs !== null && segment.startMs < durationMs ? segment.startMs : null;
  return { startMs, endMs };
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
  viewer: PlaylistViewerState;
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
  rules?: SmartPlaylistRules | null;
  forkedFromPlaylistId?: string | null;
}

export interface PlaylistPatch {
  title?: string;
  description?: string;
  visibility?: PlaylistVisibility;
  kind?: PlaylistKind;
  rules?: SmartPlaylistRules;
  autoRemoveWatched?: boolean;
  coverMode?: PlaylistCoverMode;
  coverVideoId?: string | null;
}

export type PlaylistReorder =
  | { type: 'move'; itemId: string; index: number }
  | { type: 'reindex'; itemIds: readonly string[] };
