import { type Result, assertNever, err, map, ok } from '@kit/result';
import type { Playlist, PlaylistCoverMode, PlaylistPatch } from '@vp/domain';
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
}

export type PlaylistSettingsFailure =
  | PlaylistIsSmart
  | PlaylistNotSmart
  | PlaylistHasCollaborators
  | InvalidField;

type Settings = Pick<PlaylistPatch, 'rules' | 'autoRemoveWatched' | 'coverMode' | 'coverVideoId'>;
type Cover = Pick<PlaylistPatch, 'coverMode' | 'coverVideoId'>;

/** The video an `item` cover would show once the patch lands: the one named, else the one held. */
export function coverVideoOf(playlist: Playlist, patch: PlaylistPatch): string | null {
  return patch.coverVideoId === undefined ? playlist.coverVideoId : patch.coverVideoId;
}

/**
 * Rules change only on a smart playlist, which is never a series and never removes what it never
 * stored. Watched videos leave only a list its owner has alone, because watched is one viewer's fact.
 */
export function decidePlaylistSettings(
  playlist: Playlist,
  patch: PlaylistPatch,
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

/** Naming a cover video alone picks the `item` mode; the other modes show no one video. */
function decideCover(
  playlist: Playlist,
  patch: PlaylistPatch,
  { holdsCoverVideo }: PlaylistSettingsContext
): Result<Cover, InvalidField> {
  if (patch.coverMode === undefined && patch.coverVideoId === undefined) return ok({});
  const mode: PlaylistCoverMode =
    patch.coverMode ?? (patch.coverVideoId === undefined ? playlist.coverMode : 'item');
  switch (mode) {
    case 'auto':
      return ok({ coverMode: 'auto', coverVideoId: null });
    case 'item': {
      const videoId = coverVideoOf(playlist, patch);
      return videoId !== null && holdsCoverVideo
        ? ok({ coverMode: 'item', coverVideoId: videoId })
        : err(invalidField('coverVideoId', 'An item cover shows a video the playlist holds', {}));
    }
    case 'custom':
      return playlist.customThumbnailKey === null
        ? err(invalidField('coverMode', 'A custom cover needs an uploaded image', {}))
        : ok({ coverMode: 'custom', coverVideoId: null });
    default:
      return assertNever(mode, 'PlaylistCoverMode');
  }
}
