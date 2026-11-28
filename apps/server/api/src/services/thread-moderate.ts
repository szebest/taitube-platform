import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, err, ignore, isErr, map, ok } from '@kit/result';
import type { CommentActionBody, ModerationResultView } from '@vp/api-contracts';
import { type ModerationNotice, commentModerationAudit, isStored } from '@vp/domain';
import {
  type ModerateThreadFailure,
  type ThreadNotFound,
  decideThreadModeration,
  moderationNotApplicable,
  threadNotFound,
} from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';
import { auditActor } from './audit-actor';
import { actionOf } from './moderation-action';
import {
  type RemoveThreadServiceFailure,
  type ThreadManageDeps,
  removeThread,
  threadAndVideo,
} from './thread-manage';

export type ModerateThreadServiceFailure =
  | ModerateThreadFailure
  | RemoveThreadServiceFailure
  | ThreadNotFound
  | DatabaseUnavailable;

/** A moderator's action on a thread by its id: the held comment's path, with the thread's own writes. */
export async function moderateThread(
  deps: ThreadManageDeps,
  actor: UserContext,
  threadId: string,
  body: CommentActionBody
): Promise<Result<ModerationResultView, ModerateThreadServiceFailure>> {
  if (body.action === 'remove') {
    return map(await removeThread(deps, actor, threadId, body), () => ({
      state: 'removed' as const,
      comment: null,
    }));
  }

  const found = await threadAndVideo(deps, threadId);
  if (isErr(found)) return found;
  const { thread, video } = found.value;
  if (!thread) return err(threadNotFound(threadId));
  const settings = await deps.settings.get(thread.channelId);
  if (isErr(settings)) return settings;

  const action = actionOf(body, settings.value.disclosure);
  const decided = decideThreadModeration({ actor, thread, threadId, video, action });
  if (isErr(decided)) return decided;
  const { outcome, thread: current, video: host } = decided.value;
  if (!isStored(outcome)) {
    return err(moderationNotApplicable(action.action, current.moderationState, 'state'));
  }

  const disclosure = outcome.disclosure ?? current.moderationDisclosure ?? 'silent';
  const notice: ModerationNotice | undefined =
    outcome.disclosure === 'visible' && (action.action === 'hold' || action.action === 'hide')
      ? {
          userId: current.authorId,
          action: action.action,
          channelId: host.channelId,
          videoId: host.id,
          commentId: null,
          reason: outcome.reason,
          expiresAt: null,
          excerpt: null,
        }
      : undefined;

  const written = await deps.threads.moderate({
    id: current.id,
    from: current.moderationState,
    outcome,
    audit: commentModerationAudit({
      channelId: host.channelId,
      ...auditActor(actor),
      action: action.action,
      commentId: current.id,
      videoId: host.id,
      disclosure,
    }),
    ...(notice && { notice }),
  });
  if (isErr(written)) return written;
  if (written.value.type === 'missing') return err(threadNotFound(threadId));
  if (written.value.type === 'stale') {
    return err(moderationNotApplicable(action.action, written.value.state, 'state'));
  }

  ignore(
    await deps.commentCache.invalidate({ type: 'thread', id: current.id }),
    'the write is committed; the hot page expires on its own TTL'
  );
  return ok({ state: outcome.state, comment: null });
}
