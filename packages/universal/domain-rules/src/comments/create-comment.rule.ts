import { type Comment, type Video, threadRootId } from '@vp/domain';
import { type UserContext, canCreateComment } from '@vp/permissions';
import { type Result, andThen, err, map, ok } from '@vp/result';
import { type InvalidCommentContent, validateCommentContent } from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type ReadVideoFailure, decideVideoRead } from '../videos/index';
import { type CommentNotFound, commentNotFound } from './failures';

export interface CreateCommentInput {
  readonly author: UserContext | null;
  readonly video: Video | null;
  readonly videoId: string;
  readonly parent: Comment | null;
  readonly parentId: string | null;
  readonly content: string;
}

export interface CommentToCreate {
  readonly video: Video;
  readonly parentId: string | null;
  readonly content: string;
}

export type CreateCommentFailure =
  | AuthorizationFailure
  | ReadVideoFailure
  | CommentNotFound
  | InvalidCommentContent;

function threadParent(
  input: CreateCommentInput,
  video: Video
): Result<string | null, CommentNotFound> {
  if (input.parentId === null) return ok(null);
  if (!input.parent || input.parent.videoId !== video.id) {
    return err(commentNotFound(input.parentId));
  }
  return ok(threadRootId(input.parent));
}

/**
 * Permission first, so an anonymous caller learns nothing about which videos exist. A parent
 * under another video is reported absent rather than forbidden: from this video it is not there.
 */
export function decideCommentCreate(
  input: CreateCommentInput
): Result<CommentToCreate, CreateCommentFailure> {
  return andThen(
    authorize(input.author, canCreateComment({ user: input.author }), {
      action: 'create',
      subject: 'Comment',
    }),
    (author): Result<CommentToCreate, CreateCommentFailure> =>
      andThen(
        decideVideoRead({ viewer: author, video: input.video, videoId: input.videoId }),
        (video) =>
          andThen(threadParent(input, video), (parentId) =>
            map(validateCommentContent(input.content), (content) => ({ video, parentId, content }))
          )
      )
  );
}
