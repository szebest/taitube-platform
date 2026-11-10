import type { BulkActionBody, BulkResultView, CommentActionBody } from '@vp/api-contracts';
import type { CommentRepositoryPort, VideoRepository } from '@vp/core/repositories';
import type { ActingChannel } from '@vp/domain';
import { commentNotFound } from '@vp/domain-rules';
import type { AnyFailure, ErrorCode } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, isErr, ok } from '@vp/result';
import type { ChannelRestrictionService } from './channel-restriction-service';
import type { CommentModerationService } from './comment-moderation-service';

export interface CommentBulkServiceDeps {
  comments: Pick<CommentRepositoryPort, 'findById'>;
  videos: Pick<VideoRepository, 'findById'>;
  moderation: Pick<CommentModerationService, 'moderate'>;
  restrictions: Pick<ChannelRestrictionService, 'restrict' | 'lift'>;
}

type Outcome = { ok: true } | { ok: false; code: ErrorCode };

const outcomeOf = (result: Result<unknown, AnyFailure>): Outcome =>
  isErr(result) ? { ok: false, code: result.error.code } : { ok: true };

const isCommentAction = (action: BulkActionBody): action is CommentActionBody =>
  ['hold', 'approve', 'hide', 'unhide', 'remove'].includes(action.action);

/**
 * One action over many comments. Each id is decided by the rule of its own action, in the order
 * sent, so a refusal is one id's `code` and never the batch's failure.
 */
export class CommentBulkService {
  constructor(private readonly deps: CommentBulkServiceDeps) {}

  async apply(
    user: UserContext,
    acting: ActingChannel,
    ids: readonly string[],
    action: BulkActionBody
  ): Promise<Result<BulkResultView, never>> {
    const outcomes = isCommentAction(action)
      ? await this.commentActions(user, ids, action)
      : await this.userActions(user, acting, ids, action);
    return ok({ results: ids.map((id, index) => ({ id, ...outcomes[index] })) } as BulkResultView);
  }

  private async commentActions(
    user: UserContext,
    ids: readonly string[],
    action: CommentActionBody
  ): Promise<Outcome[]> {
    const outcomes: Outcome[] = [];
    for (const id of ids)
      outcomes.push(outcomeOf(await this.deps.moderation.moderate(user, id, action)));
    return outcomes;
  }

  /** A user action reaches each author once, and answers for every one of their comments in the batch. */
  private async userActions(
    user: UserContext,
    acting: ActingChannel,
    ids: readonly string[],
    action: Exclude<BulkActionBody, CommentActionBody>
  ): Promise<Outcome[]> {
    const byAuthor = new Map<string, Outcome>();
    const outcomes: Outcome[] = [];
    for (const id of ids) {
      const author = await this.authorOnChannel(acting, id);
      if (author === null) {
        outcomes.push({ ok: false, code: commentNotFound(id).code });
        continue;
      }
      if (!byAuthor.has(author)) {
        const result =
          action.action === 'lift'
            ? await this.deps.restrictions.lift(user, acting, author)
            : await this.deps.restrictions.restrict(user, acting, author, action);
        byAuthor.set(author, outcomeOf(result));
      }
      outcomes.push(byAuthor.get(author) ?? { ok: true });
    }
    return outcomes;
  }

  private async authorOnChannel(acting: ActingChannel, commentId: string): Promise<string | null> {
    const comment = await this.deps.comments.findById(commentId);
    if (isErr(comment) || !comment.value) return null;

    const video = await this.deps.videos.findById(comment.value.videoId);
    return !isErr(video) && video.value?.ownerId === acting.ownerId ? comment.value.authorId : null;
  }
}
