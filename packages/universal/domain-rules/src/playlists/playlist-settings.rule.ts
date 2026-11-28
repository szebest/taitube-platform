import { type Result, assertNever, err, map, ok } from '@kit/result';
import type { Playlist, PlaylistChange, PlaylistCoverMode, PlaylistPatch } from '@vp/domain';
import { type InvalidField, invalidField } from '@vp/validation';
import {
  type PlaylistHasCollaborators,
  type PlaylistIsSmart,
  type PlaylistNotSmart,
  playlistHasCollaborators,
  playlistIsSmart,
  playlistNotSmart,
} from './failures';

/** What a settings change is decided against beside the row: the seats and the items held. */
export interface PlaylistSettingsContext {
  readonly seated: number;
  /** Whether the playlist holds the video an `item` cover would show. */
  readonly holdsCoverVideo: boolean;
  /** The kept variant of the ready cover `coverUploadId` names, when it is the owner's; else null. */
  readonly coverImageKey: string | null;
}

export type PlaylistSettingsFailure =
  | PlaylistIsSmart
  | PlaylistNotSmart
  | PlaylistHasCollaborators
  | InvalidField;

type Cover = Pick<PlaylistPatch, 'coverMode' | 'coverVideoId' | 'customThumbnailKey'>;
type Settings = Pick<PlaylistPatch, 'rules' | 'autoRemoveWatched'> & Cover;

/** The video an `item` cover would show once the patch lands: the one named, else the one held. */
export function coverVideoOf(playlist: Playlist, patch: PlaylistChange): string | null {
  return patch.coverVideoId === undefined ? playlist.coverVideoId : patch.coverVideoId;
}

/**
 * Rules change only on a smart playlist, which is never a series and never removes what it never
 * stored. Watched videos leave only a list its owner has alone, because watched is one viewer's fact.
 */
export function decidePlaylistSettings(
  playlist: Playlist,
  patch: PlaylistChange,
  context: PlaylistSettingsContext
): Result<Settings, PlaylistSettingsFailure> {
  const { rules, autoRemoveWatched, kind } = patch;
  const smart = playlist.rules !== null;
  if (rules !== undefined && !smart) return err(playlistNotSmart(playlist.id));
  if (smart && (kind === 'series' || autoRemoveWatched === true)) {
    return err(playlistIsSmart(playlist.id));
  }
  if (autoRemoveWatched === true && context.seated > 0) {
    return err(playlistHasCollaborators(playlist.id));
  }
  return map(decideCover(playlist, patch, context), (cover) => ({
    ...(rules === undefined ? {} : { rules }),
    ...(autoRemoveWatched === undefined ? {} : { autoRemoveWatched }),
    ...cover,
  }));
}

/**
 * Naming a cover video alone picks the `item` mode, naming an uploaded image the `custom` one; the
 * other modes show no one video.
 */
function decideCover(
  playlist: Playlist,
  patch: PlaylistChange,
  context: PlaylistSettingsContext
): Result<Cover, InvalidField> {
  const { coverMode, coverVideoId, coverUploadId } = patch;
  if (coverMode === undefined && coverVideoId === undefined && coverUploadId === undefined) {
    return ok({});
  }
  const mode: PlaylistCoverMode = coverMode ?? impliedCoverMode(playlist, patch);
  switch (mode) {
    case 'auto':
      return ok({ coverMode: 'auto', coverVideoId: null });
    case 'item': {
      const videoId = coverVideoOf(playlist, patch);
      return videoId !== null && context.holdsCoverVideo
        ? ok({ coverMode: 'item', coverVideoId: videoId })
        : err(invalidField('coverVideoId', 'An item cover shows a video the playlist holds', {}));
    }
    case 'custom':
      return customCover(playlist, coverUploadId, context.coverImageKey);
    default:
      return assertNever(mode, 'PlaylistCoverMode');
  }
}

function impliedCoverMode(playlist: Playlist, patch: PlaylistChange): PlaylistCoverMode {
  if (patch.coverUploadId !== undefined) return 'custom';
  return patch.coverVideoId === undefined ? playlist.coverMode : 'item';
}

/** A new image replaces the kept one only once its job is done; without one, the kept one is shown. */
function customCover(
  playlist: Playlist,
  coverUploadId: string | undefined,
  coverImageKey: string | null
): Result<Cover, InvalidField> {
  if (coverUploadId !== undefined) {
    return coverImageKey === null
      ? err(invalidField('coverUploadId', 'A custom cover is a processed image of the owner', {}))
      : ok({ coverMode: 'custom', coverVideoId: null, customThumbnailKey: coverImageKey });
  }
  return playlist.customThumbnailKey === null
    ? err(invalidField('coverMode', 'A custom cover needs an uploaded image', {}))
    : ok({ coverMode: 'custom', coverVideoId: null });
}
