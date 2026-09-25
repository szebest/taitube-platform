import type { Comment, Video } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { type Result, err, map } from '@vp/result';
import { type ReadVideoFailure, decideVideoRead } from '../videos/index';
import { type CommentNotFound, commentNotFound } from './failures';

export interface ReadCommentThreadInput {
  readonly viewer: UserContext | null;
  readonly comment: Comment | null;
  readonly commentId: string;
  readonly video: Video | null;
}

export type ReadCommentThreadFailure = CommentNotFound | ReadVideoFailure;

/** A thread is as readable as the video it hangs under. */
export function decideCommentThreadRead(
  input: ReadCommentThreadInput
): Result<{ comment: Comment; video: Video }, ReadCommentThreadFailure> {
  const { comment, video } = input;
  if (!(comment && video)) return err(commentNotFound(input.commentId));

  return map(decideVideoRead({ viewer: input.viewer, video, videoId: video.id }), () => ({
    comment,
    video,
  }));
}
