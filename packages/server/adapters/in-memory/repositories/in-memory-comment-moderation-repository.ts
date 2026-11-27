import { isErr, ok, type Result, unwrapOr } from '@kit/result';
import type {
  CommentLocator,
  CommentModerationRepositoryPort,
  CommentModerationWrite,
  CommentModerationWritten,
  CommentRemovalQuery,
  OutboxRepository,
  UserEventRepository,
} from '@vp/core/repositories';
import { type CommentRemoval, type CommentTarget, commentCreated } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { commentOutbox } from '@vp/job-contracts';
import { recordModeration } from './comment-moderation-record';
import { toThreadOf } from './comment-projections';
import { isVisibleTo, publicScopeOf } from './comment-public-scope';
import { recountAuthored } from './comment-recount';
import { moveCommentsCount, ownerOf, sameTarget } from './comment-targets';
import { repliesOf, standing, type StoredComment } from './comment-visibility';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import type { InMemoryChannelPostRepository } from './in-memory-channel-post-repository';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';
import type { InMemoryChannelUserRestrictionRepository } from './in-memory-channel-user-restriction-repository';
import type { InMemoryCommentRepository } from './in-memory-comment-repository';
import type { InMemoryVideoRepository } from './in-memory-video-repository';
import { byKeysetDesc, isKeysetBefore } from './keyset';

export interface InMemoryCommentModerationRepositoryOptions {
  commentsRepo: Pick<InMemoryCommentRepository, 'comments' | 'removals'>;
  videosRepo: InMemoryVideoRepository;
  postsRepo: Pick<InMemoryChannelPostRepository, 'posts'>;
  channelsRepo: InMemoryChannelRepository;
  restrictionsRepo: Pick<InMemoryChannelUserRestrictionRepository, 'shadowedUserIds'>;
  auditRepo: Pick<InMemoryChannelAuditRepository, 'append'>;
  outboxRepo: OutboxRepository;
  userEventsRepo: UserEventRepository;
}

export class InMemoryCommentModerationRepository implements CommentModerationRepositoryPort {
  constructor(private readonly deps: InMemoryCommentModerationRepositoryOptions) {}

  async moderate({
    comment: target,
    from,
    outcome,
    moderatorId,
    audit,
    notice,
  }: CommentModerationWrite): Promise<Result<CommentModerationWritten, DatabaseUnavailable>> {
    const { comments } = this.deps.commentsRepo;
    const stored = standing(comments.values()).find(
      (row) => row.id === target.id && sameTarget(row.target, target.target)
    );
    const owner = await ownerOf(this.deps, target.target);
    if (!(stored && owner)) return ok({ type: 'missing' });
    if (stored.moderationState !== from)
      return ok({ type: 'stale', state: stored.moderationState });

    const scope = publicScopeOf(comments, [stored.channelId], {
      restrictions: this.deps.restrictionsRepo,
    });
    const subtree = (): StoredComment[] =>
      standing(comments.values()).filter(
        (row) => row.id === stored.id || row.parentId === stored.id
      );
    const counted = () => subtree().filter((row) => isVisibleTo(null, row, scope)).length;

    const before = counted();
    const heldBefore = stored.heldReason !== null;
    Object.assign(stored, {
      moderationState: outcome.state,
      moderationDisclosure: outcome.disclosure,
      moderationReason: outcome.reason,
      moderationNote: outcome.note,
      moderatedBy: moderatorId,
      moderatedAt: new Date(),
      heldReason: null,
      ...(outcome.state === 'published' ? {} : { isPinned: false }),
    });
    await moveCommentsCount(this.deps, stored.target, counted() - before);

    const recorded = await recordModeration(this.deps, { audit, ...(notice && { notice }) });
    if (isErr(recorded)) return recorded;

    const channel = unwrapOr(await this.deps.channelsRepo.findById(stored.authorChannelId), null);
    const thread = toThreadOf(stored, channel, repliesOf(comments.values(), stored.id).length);
    const firstPublication = outcome.state === 'published' && from === 'held' && heldBefore;
    if (firstPublication && owner.type === 'video') {
      const queued = await this.deps.outboxRepo.enqueue(
        commentOutbox({ videoId: owner.id, commentId: stored.id })
      );
      if (isErr(queued)) return queued;
      if (owner.ownerId !== stored.authorId) {
        const told = await this.deps.userEventsRepo.append({
          userId: owner.ownerId,
          ...commentCreated(thread, { id: owner.id, title: owner.title }),
        });
        if (isErr(told)) return told;
      }
    }
    return ok({ type: 'applied', thread, firstPublication });
  }

  /** What a restriction runs after it changes: the channel's targets the user commented on, counted again. */
  async recount(channelId: string, userId: string): Promise<CommentTarget[]> {
    const { comments } = this.deps.commentsRepo;
    const scope = publicScopeOf(comments, [channelId], {
      restrictions: this.deps.restrictionsRepo,
    });
    return recountAuthored(this.deps, comments, channelId, userId, scope);
  }

  async threadIds(target: CommentLocator): Promise<Result<string[], DatabaseUnavailable>> {
    return ok(
      standing(this.deps.commentsRepo.comments.values())
        .filter(
          (row) =>
            sameTarget(row.target, target.target) &&
            (row.id === target.id || row.parentId === target.id)
        )
        .map(({ id }) => id)
    );
  }

  async idsByAuthor(
    authorId: string,
    ownerId: string
  ): Promise<Result<string[], DatabaseUnavailable>> {
    const owned = new Set(
      this.deps.channelsRepo
        .getAllChannels()
        .filter((channel) => channel.userId === ownerId)
        .map(({ id }) => id)
    );
    return ok(
      standing(this.deps.commentsRepo.comments.values())
        .filter((row) => row.authorId === authorId && owned.has(row.channelId))
        .map(({ id }) => id)
    );
  }

  async listRemovals(
    authorId: string,
    { since, cursor, limit }: CommentRemovalQuery
  ): Promise<Result<CommentRemoval[], DatabaseUnavailable>> {
    const keyOf = ({ createdAt, id }: { createdAt: Date; id: string }) => ({
      sort: createdAt,
      tie: id,
    });
    return ok(
      [...this.deps.commentsRepo.removals.values()]
        .filter(
          (row) =>
            row.authorId === authorId &&
            row.disclosure === 'visible' &&
            row.createdAt >= since &&
            isKeysetBefore(keyOf(row), cursor && keyOf(cursor))
        )
        .sort((a, b) => byKeysetDesc(keyOf(a), keyOf(b)))
        .slice(0, limit + 1)
        .map((row) => ({ ...row }))
    );
  }

  async purgeRemovalsBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    const { removals } = this.deps.commentsRepo;
    const old = [...removals.values()].filter((row) => row.createdAt < cutoff);
    for (const row of old) removals.delete(row.id);
    return ok(old.length);
  }

  clear(): void {}
}
