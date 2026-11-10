import type { Comment, CommentEditWrite, Video } from '@vp/domain';
import { type CommentGateFailure, evaluateCommentGate } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, isErr, ok } from '@vp/result';
import { looksLikeQuestion } from '@vp/validation';
import { moderatorsOf, type CommentCreateDeps } from './comment-create';
import { loadCommentGate } from './comment-gate-context';

export type CommentEditFailure = CommentGateFailure | DatabaseUnavailable;

/**
 * What an edit writes with the new text: the gate runs again, so a published comment edited into a
 * blocked word or a link off the allowlist is held like a new one. A held or hidden comment stays
 * where a moderator put it.
 */
export async function decideCommentEdit(
  deps: CommentCreateDeps,
  actor: UserContext,
  comment: Comment,
  video: Video | null,
  content: string
): Promise<Result<CommentEditWrite, CommentEditFailure>> {
  const edit: CommentEditWrite = { looksLikeQuestion: looksLikeQuestion(content) };
  if (!video) return ok(edit);

  const gate = await loadCommentGate(deps, actor, video, new Date(deps.now()));
  if (isErr(gate)) return gate;
  if (!gate.value) return ok(edit);

  const verdict = evaluateCommentGate(gate.value.settings, gate.value.context, content);
  if (isErr(verdict)) return verdict;
  const { decision, heldReason, disclosure } = verdict.value;
  if (comment.moderationState !== 'published' || decision !== 'hold') return ok(edit);
  if (!(heldReason && disclosure)) return ok(edit);

  const moderators = await moderatorsOf(deps, gate.value.channelId, video.ownerId);
  if (isErr(moderators)) return moderators;
  return ok({
    ...edit,
    hold: { reason: heldReason, disclosure, moderators: moderators.value },
  });
}
