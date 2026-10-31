import type { EditorPick, Video } from '@vp/domain';
import { type UserContext, canManagePick } from '@vp/permissions';
import { type Result, andThen, err, map } from '@vp/result';
import { type InvalidPickNote, validatePickNote } from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type InvalidPickWindow,
  type PickNotFound,
  type PickWindowOverlap,
  pickNotFound,
} from './failures';
import { decidePickNoOverlap } from './pick-overlap.rule';
import { type PickVideoFailure, decidePickVideo } from './pick-video.rule';
import { validatePickWindow } from './pick-window.rule';

export interface UpdatePickInput {
  readonly actor: UserContext | null;
  readonly pick: EditorPick | null;
  readonly pickId: string;
  readonly patch: {
    readonly videoId?: string;
    readonly startsAt?: Date;
    readonly endsAt?: Date;
    readonly note?: string | null;
  };
  /** The video the pick will show once patched: the patch's, or the pick's own. */
  readonly video: Video | null;
  readonly now: Date;
  /** A pick other than this one holding part of the patched window. */
  readonly overlapping: EditorPick | null;
}

export interface UpdatedPick {
  readonly pick: EditorPick;
  readonly video: Video;
}

export type UpdatePickFailure =
  | AuthorizationFailure
  | PickNotFound
  | PickVideoFailure
  | InvalidPickWindow
  | PickWindowOverlap
  | InvalidPickNote;

/** The pick as it will be stored, with its video: an omitted field keeps its value, `note: null` clears it. */
export function decidePickUpdate(input: UpdatePickInput): Result<UpdatedPick, UpdatePickFailure> {
  const { pick, patch } = input;
  return andThen(
    authorize(input.actor, canManagePick({ user: input.actor }), {
      action: 'update',
      subject: 'Pick',
    }),
    (): Result<UpdatedPick, Exclude<UpdatePickFailure, AuthorizationFailure>> => {
      if (!pick) return err(pickNotFound(input.pickId));
      const videoId = patch.videoId ?? pick.videoId;
      const startsAt = patch.startsAt ?? pick.startsAt;
      const endsAt = patch.endsAt ?? pick.endsAt;

      return andThen(decidePickVideo(input.video, videoId), (video) =>
        andThen(validatePickWindow({ startsAt, endsAt }, input.now), (window) =>
          andThen(decidePickNoOverlap(window, input.overlapping), () =>
            map(validatePickNote(patch.note === undefined ? pick.note : patch.note), (note) => ({
              pick: { ...pick, videoId, startsAt, endsAt, note },
              video,
            }))
          )
        )
      );
    }
  );
}
