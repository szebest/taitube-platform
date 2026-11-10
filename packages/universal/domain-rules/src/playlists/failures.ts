import { ErrorCodes, type Failure, type InputFailure } from '@vp/errors';

export type PlaylistNotFound = Failure<
  typeof ErrorCodes.PLAYLIST_NOT_FOUND,
  { playlistId: string }
>;

export type PlaylistItemNotFound = Failure<
  typeof ErrorCodes.PLAYLIST_ITEM_NOT_FOUND,
  { playlistId: string; itemId: string }
>;

export type SystemPlaylistImmutable = Failure<
  typeof ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE,
  { playlistId: string }
>;

export function playlistNotFound(playlistId: string): PlaylistNotFound {
  return { code: ErrorCodes.PLAYLIST_NOT_FOUND, message: 'Playlist not found', playlistId };
}

export function playlistItemNotFound(playlistId: string, itemId: string): PlaylistItemNotFound {
  return {
    code: ErrorCodes.PLAYLIST_ITEM_NOT_FOUND,
    message: 'The playlist holds no such item',
    playlistId,
    itemId,
  };
}

export function systemPlaylistImmutable(playlistId: string): SystemPlaylistImmutable {
  return {
    code: ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE,
    message: 'A system playlist cannot be renamed or deleted',
    playlistId,
  };
}

export type SeriesVideoNotOwned = InputFailure<
  typeof ErrorCodes.SERIES_VIDEO_NOT_OWNED,
  { playlistId: string; videoId: string }
>;

export function seriesVideoNotOwned(playlistId: string, videoId: string): SeriesVideoNotOwned {
  return {
    code: ErrorCodes.SERIES_VIDEO_NOT_OWNED,
    message: 'A series holds only videos of its own channel',
    field: 'videoId',
    playlistId,
    videoId,
  };
}
