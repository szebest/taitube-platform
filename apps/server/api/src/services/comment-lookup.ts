import type { CommentRepositoryPort, VideoRepository } from '@vp/core/repositories';
import type { Comment, Video } from '@vp/domain';
import { decideVideoRead, publicReadFailure } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isErr, map, ok } from '@vp/result';

export interface CommentLookupDeps {
  comments: CommentRepositoryPort;
  videos: VideoRepository;
}

/** A live comment with the video it sits under; either is null once it is gone. */
export async function commentWithVideo(deps: CommentLookupDeps, commentId: string) {
  const comment = await deps.comments.findById(commentId);
  if (isErr(comment)) return comment;
  if (!comment.value) return ok({ comment: null, video: null });

  const video = await deps.videos.findById(comment.value.videoId);
  return map(video, (found): { comment: Comment | null; video: Video | null } => ({
    comment: comment.value,
    video: found,
  }));
}

export type PublicReadFailure = ReturnType<typeof publicReadFailure>;

export async function readableVideo(
  deps: Pick<CommentLookupDeps, 'videos'>,
  viewer: UserContext | null,
  videoId: string
): Promise<Result<Video, DatabaseUnavailable | PublicReadFailure>> {
  const found = await deps.videos.findById(videoId);
  if (isErr(found)) return found;

  const decided = decideVideoRead({ viewer, video: found.value, videoId });
  return isErr(decided) ? err(publicReadFailure(decided.error)) : decided;
}
