import type {
  CommentModerationRepositoryPort,
  NotificationRepositoryPort,
} from '@vp/core/repositories';
import type { CommentThread, Video } from '@vp/domain';
import {
  type CommentGateFailure,
  type UpdateCommentFailure,
  commentNotFound,
  decideCommentUpdate,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isErr, ok } from '@vp/result';
import type { CommentCreateDeps } from './comment-create';
import { decideCommentEdit } from './comment-edit';
import { commentWithVideo } from './comment-lookup';

export interface CommentUpdateDeps extends CommentCreateDeps {
  moderation: Pick<CommentModerationRepositoryPort, 'threadIds'>;
  notifications: Pick<NotificationRepositoryPort, 'withdrawUnread'>;
}

export type UpdateCommentServiceFailure =
  | UpdateCommentFailure
  | CommentGateFailure
  | DatabaseUnavailable;

/**
 * The author rewrites a comment under the gate that took the first version: a published comment
 * edited into a hold leaves the public count with its replies and takes its unread notifications back.
 */
export async function updateComment(
  deps: CommentUpdateDeps,
  actor: UserContext,
  commentId: string,
  content: string
): Promise<Result<{ thread: CommentThread; video: Video }, UpdateCommentServiceFailure>> {
  const found = await commentWithVideo(deps, commentId);
  if (isErr(found)) return found;
  const { comment, video } = found.value;

  const decided = decideCommentUpdate({ actor, comment, commentId, content });
  if (isErr(decided)) return decided;
  const { content: text, comment: target } = decided.value;

  const edit = await decideCommentEdit(deps, actor, target, video, text);
  if (isErr(edit)) return edit;

  const written = await deps.comments.updateContent(commentId, text, edit.value);
  if (isErr(written)) return written;
  if (!(written.value && video)) return err(commentNotFound(commentId));
  if (!edit.value.hold) return ok({ thread: written.value, video });

  const ids = await deps.moderation.threadIds({ id: commentId, videoId: target.videoId });
  if (isErr(ids)) return ids;
  const withdrawn = await deps.notifications.withdrawUnread(ids.value);
  return isErr(withdrawn) ? withdrawn : ok({ thread: written.value, video });
}
