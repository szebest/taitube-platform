import type { CommentView } from '@vp/api-contracts';
import type { CommentRepositoryPort } from '@vp/core/repositories';
import { type CreateCommentFailure, commentNotFound, decideCommentCreate } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isErr, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { type CommentLookupDeps, type PublicReadFailure, readableVideo } from './comment-lookup';
import { toCommentView } from './comment-views';

export type CreateCommentServiceFailure =
  | CreateCommentFailure
  | PublicReadFailure
  | DatabaseUnavailable;

export async function createComment(
  deps: CommentLookupDeps & { comments: CommentRepositoryPort },
  author: UserContext,
  videoId: string,
  body: { content: string; parentId?: string }
): Promise<Result<CommentView, CreateCommentServiceFailure>> {
  const video = await readableVideo(deps, author, videoId);
  if (isErr(video)) return video;
  const parentId = body.parentId ?? null;
  const parent = parentId ? await deps.comments.findById(parentId) : ok(null);
  if (isErr(parent)) return parent;

  const decided = decideCommentCreate({
    author,
    video: video.value,
    videoId,
    parent: parent.value,
    parentId,
    content: body.content,
  });
  if (isErr(decided)) return decided;

  const created = await deps.comments.create({
    id: uuidv7(),
    videoId,
    authorId: author.id,
    parentId: decided.value.parentId,
    content: decided.value.content,
  });
  if (isErr(created)) return created;
  if (!created.value) return err(commentNotFound(parentId ?? videoId));

  return ok(toCommentView(created.value, decided.value.video.ownerId));
}
