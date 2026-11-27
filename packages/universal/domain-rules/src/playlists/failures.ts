import { type Failure, type InputFailure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';

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
    message: 'A system playlist cannot be renamed, deleted or shared',
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

export type PlaylistCollaboratorExists = Failure<
  typeof ErrorCodes.PLAYLIST_COLLABORATOR_EXISTS,
  { playlistId: string; userId: string }
>;

export type PlaylistCollaboratorLimit = Failure<
  typeof ErrorCodes.PLAYLIST_COLLABORATOR_LIMIT,
  { playlistId: string }
>;

export type PlaylistCollaboratorNotFound = Failure<
  typeof ErrorCodes.PLAYLIST_COLLABORATOR_NOT_FOUND,
  { playlistId: string; userId: string }
>;

export type PlaylistInviteInvalid = Failure<typeof ErrorCodes.PLAYLIST_INVITE_INVALID>;

export type PlaylistActivityNotFound = Failure<
  typeof ErrorCodes.PLAYLIST_ACTIVITY_NOT_FOUND,
  { playlistId: string; activityId: string }
>;

export type PlaylistActivityNotRestorable = Failure<
  typeof ErrorCodes.PLAYLIST_ACTIVITY_NOT_RESTORABLE,
  { activityId: string }
>;

export function playlistCollaboratorExists(
  playlistId: string,
  userId: string
): PlaylistCollaboratorExists {
  return {
    code: ErrorCodes.PLAYLIST_COLLABORATOR_EXISTS,
    message: 'This person already works on the playlist',
    playlistId,
    userId,
  };
}

export function playlistCollaboratorLimit(playlistId: string): PlaylistCollaboratorLimit {
  return {
    code: ErrorCodes.PLAYLIST_COLLABORATOR_LIMIT,
    message: 'The playlist holds the most collaborators it can',
    playlistId,
  };
}

export function playlistCollaboratorNotFound(
  playlistId: string,
  userId: string
): PlaylistCollaboratorNotFound {
  return {
    code: ErrorCodes.PLAYLIST_COLLABORATOR_NOT_FOUND,
    message: 'This person does not work on the playlist',
    playlistId,
    userId,
  };
}

/** One answer for unknown, expired, revoked, used up and someone else's: a token reveals nothing. */
export function playlistInviteInvalid(): PlaylistInviteInvalid {
  return {
    code: ErrorCodes.PLAYLIST_INVITE_INVALID,
    message: 'The invite has expired, was revoked or has been used up',
  };
}

export function playlistActivityNotFound(
  playlistId: string,
  activityId: string
): PlaylistActivityNotFound {
  return {
    code: ErrorCodes.PLAYLIST_ACTIVITY_NOT_FOUND,
    message: 'The playlist activity holds no such change',
    playlistId,
    activityId,
  };
}

export function playlistActivityNotRestorable(activityId: string): PlaylistActivityNotRestorable {
  return {
    code: ErrorCodes.PLAYLIST_ACTIVITY_NOT_RESTORABLE,
    message: 'This change removed no item, or its video is gone',
    activityId,
  };
}
