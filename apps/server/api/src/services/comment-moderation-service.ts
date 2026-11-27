import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, err, ignore, isErr, ok } from '@kit/result';
import type { CommentActionBody, ModerationResultView } from '@vp/api-contracts';
import type { CommentCachePort } from '@vp/core/ports';
import type {
  CommentModerationRepositoryPort,
  CommentSettingsRepositoryPort,
  NotificationRepositoryPort,
  VideoThreadRepositoryPort,
} from '@vp/core/repositories';
import {
  COMMENT_REMOVAL_EXCERPT_LENGTH,
  type ModerationNotice,
  NOTIFICATION_EXCERPT_LENGTH,
  commentModerationAudit,
  commentVideoId,
} from '@vp/domain';
import {
  type CommentModerationFailure,
  commentHostTraits,
  commentNotFound,
  decideCommentModeration,
  moderationNotApplicable,
} from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';
import { auditActor } from './audit-actor';
import { type CommentLookupDeps, commentWithHost } from './comment-lookup';
import { toCommentView } from './comment-views';
import { actionOf } from './moderation-action';
import { type ModerateThreadServiceFailure, moderateThread } from './thread-moderate';

export interface CommentModerationServiceDeps extends CommentLookupDeps {
  threads: VideoThreadRepositoryPort;
  settings: CommentSettingsRepositoryPort;
  moderation: CommentModerationRepositoryPort;
  notifications: Pick<NotificationRepositoryPort, 'withdrawUnread'>;
  commentCache: CommentCachePort;
}

export type ModerateCommentServiceFailure =
  | CommentModerationFailure
  | ModerateThreadServiceFailure
  | DatabaseUnavailable;

export class CommentModerationService {
  constructor(private readonly deps: CommentModerationServiceDeps) {}

  async moderate(
    actor: UserContext,
    commentId: string,
    body: CommentActionBody
  ): Promise<Result<ModerationResultView, ModerateCommentServiceFailure>> {
    const { comments, moderation } = this.deps;
    const found = await commentWithHost(this.deps, commentId);
    if (isErr(found)) return found;
    const { comment, host } = found.value;
    if (!comment) {
      const thread = await this.deps.threads.findById(commentId);
      if (isErr(thread)) return thread;
      if (thread.value) return moderateThread(this.deps, actor, thread.value.id, body);
    }
    if (!(comment && host)) return err(commentNotFound(commentId));

    const { channelId } = comment;
    const videoId = commentVideoId(comment.target);
    const settings = await this.deps.settings.get(channelId);
    if (isErr(settings)) return settings;

    const action = actionOf(body, settings.value.disclosure);
    const decided = decideCommentModeration({ actor, comment, commentId, host, action });
    if (isErr(decided)) return decided;
    const { outcome } = decided.value;

    const locator = { id: comment.id, target: comment.target };
    const leavesPublic = comment.moderationState === 'published' && outcome.state !== 'published';
    const thread = leavesPublic ? await moderation.threadIds(locator) : ok<string[]>([]);
    if (isErr(thread)) return thread;

    const audit = commentModerationAudit({
      channelId,
      ...auditActor(actor),
      action: action.action,
      commentId,
      videoId,
      disclosure: outcome.disclosure ?? comment.moderationDisclosure ?? 'silent',
    });

    const notice: ModerationNotice | undefined =
      outcome.disclosure === 'visible' && action.action !== 'approve' && action.action !== 'unhide'
        ? {
            userId: comment.authorId,
            action: action.action,
            channelId,
            videoId,
            commentId: comment.id,
            reason: outcome.reason,
            expiresAt: null,
            excerpt:
              action.action === 'remove'
                ? comment.content.slice(0, NOTIFICATION_EXCERPT_LENGTH)
                : null,
          }
        : undefined;

    let view: ModerationResultView;
    if (outcome.state === 'removed') {
      const removed = await comments.remove(locator, {
        audit,
        ...(notice && { notice }),
        removal: {
          id: comment.id,
          channelId,
          videoId,
          authorId: comment.authorId,
          excerpt: comment.content.slice(0, COMMENT_REMOVAL_EXCERPT_LENGTH),
          reason: outcome.reason ?? 'other',
          note: outcome.note,
          disclosure: outcome.disclosure ?? 'silent',
          removedBy: actor.id,
        },
      });
      if (isErr(removed)) return removed;
      if (removed.value === 0) return err(commentNotFound(commentId));
      view = { state: 'removed', comment: null };
    } else {
      const written = await moderation.moderate({
        comment: locator,
        from: comment.moderationState,
        outcome: { ...outcome, state: outcome.state },
        moderatorId: actor.id,
        audit,
        ...(notice && { notice }),
      });
      if (isErr(written)) return written;
      if (written.value.type === 'missing') return err(commentNotFound(commentId));
      if (written.value.type === 'stale') {
        return err(moderationNotApplicable(action.action, written.value.state, 'state'));
      }
      const { thread: moderated } = written.value;
      view = {
        state: outcome.state,
        comment: toCommentView(moderated, commentHostTraits(host), actor),
      };
    }

    ignore(
      await this.deps.commentCache.invalidate(comment.target),
      'the write is committed; the hot page expires on its own TTL'
    );
    const withdrawn = await this.deps.notifications.withdrawUnread(thread.value);
    return isErr(withdrawn) ? withdrawn : ok(view);
  }
}
