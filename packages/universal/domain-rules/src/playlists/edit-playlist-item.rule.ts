import { type Result, andThen, assertNever, err, ok } from '@kit/result';
import {
  PLAYLIST_SEGMENT_MIN_MS,
  type PlaylistItemPatch,
  type PlaylistSegment,
  type StoredPlaylistItem,
} from '@vp/domain';
import {
  type InvalidField,
  type InvalidPlaylistDetails,
  invalidField,
  validatePlaylistNote,
  validateSectionTitle,
} from '@vp/validation';
import {
  type ManagePlaylistFailure,
  type ManagePlaylistInput,
  decidePlaylistAction,
  decidePlaylistRead,
} from './manage-playlist.rule';
import { type PlaylistItemNotFound, playlistItemNotFound } from './failures';

export interface EditPlaylistItemInput extends ManagePlaylistInput {
  readonly itemId: string;
  readonly item: StoredPlaylistItem | null;
  readonly patch: PlaylistItemPatch;
  /** The item's video length as it is now; null for a section. */
  readonly durationMs: number | null;
}

export type EditPlaylistItemFailure =
  | ManagePlaylistFailure
  | PlaylistItemNotFound
  | InvalidPlaylistDetails
  | InvalidField;

function misplaced(field: string): InvalidField {
  return invalidField(field, `${field} does not apply to this kind of item`, {});
}

/** At least a second long, and inside the video as it is at save. */
function checkSegment(
  segment: PlaylistSegment,
  durationMs: number | null
): Result<PlaylistSegment, InvalidField> {
  const { startMs, endMs } = segment;
  const start = startMs ?? 0;
  const end = endMs ?? durationMs;
  if (startMs !== null && (startMs < 0 || (durationMs !== null && startMs >= durationMs))) {
    return err(invalidField('startMs', 'The start must fall inside the video', {}));
  }
  if (endMs !== null && durationMs !== null && endMs > durationMs) {
    return err(invalidField('endMs', 'The end must fall inside the video', {}));
  }
  if (end !== null && end - start < PLAYLIST_SEGMENT_MIN_MS) {
    return err(
      invalidField('endMs', 'A segment lasts at least a second', {
        minMs: PLAYLIST_SEGMENT_MIN_MS,
      })
    );
  }
  return ok(segment);
}

function videoPatch(
  item: StoredPlaylistItem,
  patch: PlaylistItemPatch,
  durationMs: number | null
): Result<PlaylistItemPatch, EditPlaylistItemFailure> {
  if (patch.title !== undefined) return err(misplaced('title'));
  const segment = {
    startMs: patch.startMs === undefined ? item.startMs : patch.startMs,
    endMs: patch.endMs === undefined ? item.endMs : patch.endMs,
  };
  const touchesSegment = patch.startMs !== undefined || patch.endMs !== undefined;
  return andThen(touchesSegment ? checkSegment(segment, durationMs) : ok(segment), () =>
    patch.note === undefined
      ? ok({ ...pickSegment(patch) })
      : andThen(validatePlaylistNote(patch.note), (note) => ok({ ...pickSegment(patch), note }))
  );
}

function pickSegment({ startMs, endMs }: PlaylistItemPatch): PlaylistItemPatch {
  return {
    ...(startMs === undefined ? {} : { startMs }),
    ...(endMs === undefined ? {} : { endMs }),
  };
}

function sectionPatch(patch: PlaylistItemPatch): Result<PlaylistItemPatch, EditPlaylistItemFailure> {
  if (patch.note !== undefined) return err(misplaced('note'));
  if (patch.startMs !== undefined || patch.endMs !== undefined) return err(misplaced('startMs'));
  if (patch.title === undefined) return ok({});
  return andThen(validateSectionTitle(patch.title), (title) => ok({ title }));
}

/**
 * Annotating an item is managing it: an editor touches any item, a contributor only their own. A
 * video item takes a note and a segment, a section only its title.
 */
export function decidePlaylistItemEdit(
  input: EditPlaylistItemInput
): Result<PlaylistItemPatch, EditPlaylistItemFailure> {
  const { item, itemId, playlistId, patch, durationMs } = input;
  if (!item) {
    return andThen(decidePlaylistRead(input), () => err(playlistItemNotFound(playlistId, itemId)));
  }
  return andThen(decidePlaylistAction(input, 'manageItems', item), () => {
    switch (item.kind) {
      case 'video':
        return videoPatch(item, patch, durationMs);
      case 'section':
        return sectionPatch(patch);
      default:
        return assertNever(item.kind, 'PlaylistItemKind');
    }
  });
}
