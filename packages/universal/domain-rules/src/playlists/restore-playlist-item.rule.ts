import { type Result, andThen, err, ok } from '@kit/result';
import { type PlaylistActivity, type RestorablePlaylistActivity, isRestorable } from '@vp/domain';
import {
  type ManagePlaylistFailure,
  type ManagePlaylistInput,
  decidePlaylistAction,
} from './manage-playlist.rule';
import {
  type PlaylistActivityNotFound,
  type PlaylistActivityNotRestorable,
  playlistActivityNotFound,
  playlistActivityNotRestorable,
} from './failures';

export interface RestorePlaylistItemInput extends ManagePlaylistInput {
  readonly activityId: string;
  readonly activity: PlaylistActivity | null;
}

export type RestorePlaylistItemFailure =
  | ManagePlaylistFailure
  | PlaylistActivityNotFound
  | PlaylistActivityNotRestorable;

/** Only a removal comes back: the owner puts the item back as it stood. */
export function decidePlaylistRestore(
  input: RestorePlaylistItemInput
): Result<RestorablePlaylistActivity, RestorePlaylistItemFailure> {
  return andThen(
    decidePlaylistAction(input, 'restoreItem'),
    (playlist): Result<RestorablePlaylistActivity, RestorePlaylistItemFailure> => {
      const { activity, activityId } = input;
      if (activity?.playlistId !== playlist.id) {
        return err(playlistActivityNotFound(playlist.id, activityId));
      }
      return isRestorable(activity) ? ok(activity) : err(playlistActivityNotRestorable(activityId));
    }
  );
}
