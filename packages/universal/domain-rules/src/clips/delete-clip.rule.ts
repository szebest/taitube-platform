import type { Clip } from '@vp/domain';
import { type UserContext, canDeleteClip } from '@vp/permissions';
import { type Result, err, map } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type ClipNotFound, clipNotFound } from './failures';

export interface DeleteClipInput {
  readonly actor: UserContext | null;
  readonly clip: Clip | null;
  readonly clipId: string;
}

export type DeleteClipFailure = ClipNotFound | AuthorizationFailure;

/** Deleting does not look at the video: a creator can remove a clip of a video that turned private. */
export function decideClipDelete(input: DeleteClipInput): Result<Clip, DeleteClipFailure> {
  const { actor, clip } = input;
  if (!clip) return err(clipNotFound(input.clipId));
  return map(
    authorize(actor, canDeleteClip({ user: actor, clip: { userId: clip.userId } }), {
      action: 'delete',
      subject: 'Clip',
    }),
    () => clip
  );
}
