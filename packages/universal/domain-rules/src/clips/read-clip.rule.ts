import type { Clip, Video } from '@vp/domain';
import { type UserContext, canReadVideo } from '@vp/permissions';
import { type Result, err, ok } from '@vp/result';
import { type ClipNotFound, clipNotFound } from './failures';

export interface ReadClipInput {
  readonly viewer: UserContext | null;
  readonly clip: Clip | null;
  readonly video: Video | null;
  readonly clipId: string;
}

/** A clip lives and dies with the visibility of its video, and every refusal is the same absence. */
export function decideClipRead(input: ReadClipInput): Result<Clip, ClipNotFound> {
  const { viewer, clip, video } = input;
  const watchable =
    video &&
    video.status !== 'DELETED' &&
    !video.deletedAt &&
    canReadVideo({ user: viewer, video });
  return clip && watchable ? ok(clip) : err(clipNotFound(input.clipId));
}
