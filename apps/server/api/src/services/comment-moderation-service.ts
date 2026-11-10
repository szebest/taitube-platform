import type { CommentActionBody, ModerationResultView } from '@vp/api-contracts';
import type { CommentCachePort } from '@vp/core/ports';
import type {
  ChannelRepositoryPort,
  CommentModerationRepositoryPort,
  CommentSettingsRepositoryPort,
  NotificationRepositoryPort,
} from '@vp/core/repositories';
import {
  COMMENT_REMOVAL_EXCERPT_LENGTH,
  type ModerationNotice,
  NOTIFICATION_EXCERPT_LENGTH,
  type CommentModerationAction,
  type DisclosureDefaults,
  type DisclosureRule,
  commentModerationAudit,
} from '@vp/domain';
import {
  type CommentModerationFailure,
  commentNotFound,
  decideCommentModeration,
  moderationNotApplicable,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, err, ignore, isErr, ok } from '@vp/result';
import { type CommentLookupDeps, commentWithVideo } from './comment-lookup';
import { toCommentView } from './comment-views';

export interface CommentModerationServiceDeps extends CommentLookupDeps {
  channels: Pick<ChannelRepositoryPort, 'findByUserId'>;
  settings: CommentSettingsRepositoryPort;
  moderation: CommentModerationRepositoryPort;
  notifications: Pick<NotificationRepositoryPort, 'withdrawUnread'>;
  commentCache: CommentCachePort;
}

export type ModerateCommentServiceFailure = CommentModerationFailure | DatabaseUnavailable;

const DISCLOSURE_RULE = {
  hold: 'manual_hold',
  hide: 'hide',
  remove: 'remove',
} as const satisfies Record<string, DisclosureRule>;

/** The action as the domain takes it: the disclosure is the moderator's, else the channel default. */
function actionOf(body: CommentActionBody, defaults: DisclosureDefaults): CommentModerationAction {
  switch (body.action) {
    case 'approve':
    case 'unhide':
      return { action: body.action };
    default:
      return {
        ...body,
        disclosure: body.disclosure ?? defaults[DISCLOSURE_RULE[body.action]],
      };
  }
}

export class CommentModerationService {
  constructor(private readonly deps: CommentModerationServiceDeps) {}

  async moderate(
    actor: UserContext,
    commentId: string,
    body: CommentActionBody
  ): Promise<Result<ModerationResultView, ModerateCommentServiceFailure>> {
    const { comments, moderation } = this.deps;
    const found = await commentWithVideo(this.deps, commentId);
    if (isErr(found)) return found;
    const { comment, video } = found.value;
    if (!(comment && video)) return err(commentNotFound(commentId));

    const channel = await this.deps.channels.findByUserId(video.ownerId);
    if (isErr(channel)) return channel;
    if (!channel.value) return err(commentNotFound(commentId));
    const channelId = channel.value.id;
    const settings = await this.deps.settings.get(channelId);
    if (isErr(settings)) return settings;

    const action = actionOf(body, settings.value.disclosure);
    const decided = decideCommentModeration({ actor, comment, commentId, video, action });
    if (isErr(decided)) return decided;
    const { outcome } = decided.value;

    const locator = { id: comment.id, videoId: comment.videoId };
    const leavesPublic = comment.moderationState === 'published' && outcome.state !== 'published';
    const thread = leavesPublic ? await moderation.threadIds(locator) : ok<string[]>([]);
    if (isErr(thread)) return thread;

    const audit = commentModerationAudit({
      channelId,
      actorUserId: actor.id,
      action: action.action,
      commentId,
      videoId: video.id,
      disclosure: outcome.disclosure ?? comment.moderationDisclosure ?? 'silent',
    });

    const notice: ModerationNotice | undefined =
      outcome.disclosure === 'visible' && action.action !== 'approve' && action.action !== 'unhide'
        ? {
            userId: comment.authorId,
            action: action.action,
            channelId,
            videoId: video.id,
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
          videoId: video.id,
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
        comment: toCommentView(moderated, video.ownerId, actor),
      };
    }

    ignore(
      await this.deps.commentCache.invalidate(video.id),
      'the write is committed; the hot page expires on its own TTL'
    );
    const withdrawn = await this.deps.notifications.withdrawUnread(thread.value);
    return isErr(withdrawn) ? withdrawn : ok(view);
  }
}
