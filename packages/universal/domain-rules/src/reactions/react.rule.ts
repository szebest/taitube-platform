import type { Video } from '@vp/domain';
import { type UserContext, canReactVideo } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import { type ReadVideoFailure, decideVideoRead } from '../videos/index';
import { type ReactionForbidden, reactionForbidden } from './failures';

export interface ReactInput {
  readonly reactor: UserContext | null;
  readonly video: Video | null;
  readonly videoId: string;
}

export type ReactFailure = ReadVideoFailure | ReactionForbidden;

/**
 * Reacting needs the video to be readable first, so the rule composes the read decision rather
 * than repeating its two branches.
 */
export function decideReact(input: ReactInput): Result<Video, ReactFailure> {
  return andThen(
    decideVideoRead({ viewer: input.reactor, video: input.video, videoId: input.videoId }),
    (video) =>
      canReactVideo({ user: input.reactor }) ? ok(video) : err(reactionForbidden(input.videoId))
  );
}
