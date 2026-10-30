import type { EditorPick, Video } from '@vp/domain';
import { type UserContext, canManagePick } from '@vp/permissions';
import { type Result, andThen, map } from '@vp/result';
import { type InvalidPickNote, validatePickNote } from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize';
import type { InvalidPickWindow, PickWindowOverlap } from './failures';
import { type PickVideoFailure, decidePickVideo } from './pick-video.rule';
import { decidePickNoOverlap } from './pick-overlap.rule';
import { validatePickWindow } from './pick-window.rule';

export interface CreatePickInput {
  readonly actor: UserContext | null;
  readonly video: Video | null;
  readonly videoId: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly note?: string | null;
  readonly now: Date;
  /** The pick already holding part of the window, as a repository read found it. */
  readonly overlapping: EditorPick | null;
}

export type PickToCreate = Pick<
  EditorPick,
  'videoId' | 'startsAt' | 'endsAt' | 'note' | 'createdBy'
>;

export type CreatePickFailure =
  | AuthorizationFailure
  | PickVideoFailure
  | InvalidPickWindow
  | PickWindowOverlap
  | InvalidPickNote;

export function decidePickCreate(input: CreatePickInput): Result<PickToCreate, CreatePickFailure> {
  const { startsAt, endsAt } = input;
  return andThen(
    authorize(input.actor, canManagePick({ user: input.actor }), {
      action: 'create',
      subject: 'Pick',
    }),
    (admin) =>
      andThen(decidePickVideo(input.video, input.videoId), () =>
        andThen(validatePickWindow({ startsAt, endsAt }, input.now), (window) =>
          andThen(decidePickNoOverlap(window, input.overlapping), () =>
            map(validatePickNote(input.note), (note) => ({
              videoId: input.videoId,
              startsAt,
              endsAt,
              note,
              createdBy: admin.id,
            }))
          )
        )
      )
  );
}
