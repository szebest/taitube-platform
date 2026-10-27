import type { CommentRepositoryPort, VideoRepository } from '@vp/core/repositories';
import type { Comment, Video } from '@vp/domain';
import { isErr, map, ok } from '@vp/result';

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
