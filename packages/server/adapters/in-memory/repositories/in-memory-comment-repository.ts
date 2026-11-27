import { isErr, ok, type Result, unwrapOr } from '@kit/result';
import type {
  CommentLocator,
  CommentViewer,
  CommentRepositoryPort,
  ListCommentRepliesOptions,
  ListAuthoredCommentsOptions,
  ListCommentThreadsOptions,
  ListCreatorInboxOptions,
  OutboxRepository,
  UserEventRepository,
} from '@vp/core/repositories';
import {
  type AuthoredComment,
  type Comment,
  type CommentEditWrite,
  type CommentRemoval,
  type CommentTarget,
  commentVideoId,
  type CommentThread,
  type CreatorInboxComment,
  type ModerationRecord,
  type NewChannelAuditEntry,
  type NewCommentInput,
  type NewCommentRemoval,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { announceCreated } from './comment-announce';
import { listAuthored } from './comment-authored';
import { editStored } from './comment-edit';
import { applyHeart } from './comment-heart';
import { creatorInbox } from './comment-inbox-filter';
import { recordModeration } from './comment-moderation-record';
import { commentSortKey, compareKeys, rowKey, threadPage } from './comment-order';
import { newStoredComment, toThreadOf } from './comment-projections';
import {
  isVisibleTo,
  ownNonPublic,
  ownOrPublicTo,
  type PublicScopeContext,
  publicScopeOf,
} from './comment-public-scope';
import { moveCommentsCount, ownerOf, removeTargetComments, sameTarget } from './comment-targets';
import { repliesOf, standing, type StoredComment } from './comment-visibility';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import type { InMemoryChannelPostRepository } from './in-memory-channel-post-repository';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';
import type { InMemoryChannelUserRestrictionRepository } from './in-memory-channel-user-restriction-repository';
import type { InMemoryCommentReportRepository } from './in-memory-comment-report-repository';
import type { InMemoryVideoRepository } from './in-memory-video-repository';

export interface InMemoryCommentRepositoryOptions {
  channelsRepo: InMemoryChannelRepository;
  videosRepo: InMemoryVideoRepository;
  postsRepo: Pick<InMemoryChannelPostRepository, 'posts'>;
  outboxRepo: OutboxRepository;
  auditRepo: InMemoryChannelAuditRepository;
  reportsRepo: InMemoryCommentReportRepository;
  userEventsRepo: UserEventRepository;
  restrictionsRepo: InMemoryChannelUserRestrictionRepository;
}

/** Every write takes its one await before touching state, so concurrent creates leave no half-step to observe. */
export class InMemoryCommentRepository implements CommentRepositoryPort {
  readonly comments = new Map<string, StoredComment>();
  readonly removals = new Map<string, CommentRemoval>();
  constructor(private readonly deps: InMemoryCommentRepositoryOptions) {}

  async findById(id: string): Promise<Result<Comment | null, DatabaseUnavailable>> {
    return ok(this.liveById(id) ?? null);
  }

  async findVisible(
    viewer: CommentViewer,
    id: string
  ): Promise<Result<Comment | null, DatabaseUnavailable>> {
    const scope = await this.scope([]);
    const found = this.liveById(id);
    return ok(found && isVisibleTo(viewer, found, scope) ? found : null);
  }

  async listThreads(
    target: CommentTarget,
    { viewer, sort, window }: ListCommentThreadsOptions
  ): Promise<Result<CommentThread[], DatabaseUnavailable>> {
    const scope = this.scope();
    const roots = this.live()
      .filter(
        (comment) =>
          sameTarget(comment.target, target) &&
          comment.parentId === null &&
          isVisibleTo(viewer, comment, scope)
      )
      .sort((a, b) => compareKeys(commentSortKey(sort, b), commentSortKey(sort, a)));

    const page = threadPage(roots, sort, window);

    return ok(await this.threadsOf(page, ownOrPublicTo(viewer, scope)));
  }

  async listReplies(
    root: CommentLocator,
    { viewer, cursor, limit }: ListCommentRepliesOptions
  ): Promise<Result<CommentThread[], DatabaseUnavailable>> {
    const scope = this.scope();
    const replies = this.repliesOf(root.id)
      .filter((reply) => isVisibleTo(viewer, reply, scope))
      .sort((a, b) => compareKeys(rowKey(a), rowKey(b)))
      .filter((row) => !cursor || compareKeys(rowKey(row), rowKey(cursor)) > 0)
      .slice(0, limit + 1);

    return ok(await this.threadsOf(replies, ownOrPublicTo(viewer, scope)));
  }

  async listOwnNonPublic(
    target: CommentTarget,
    authorId: string
  ): Promise<Result<CommentThread[], DatabaseUnavailable>> {
    const scope = this.scope();
    const mine = ownNonPublic(this.live(), target, authorId, scope);
    return ok(await this.threadsOf(mine, ownOrPublicTo({ id: authorId }, scope)));
  }

  async create(
    input: NewCommentInput,
    audit?: NewChannelAuditEntry
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    const owner = await ownerOf(this.deps, input.target);
    const scope = this.scope([input.channelId]);
    if (input.parentId !== null && !this.liveById(input.parentId)) return ok(null);
    const stored = newStoredComment(input, new Date());
    this.comments.set(stored.id, stored);
    const counted = isVisibleTo(null, stored, scope);
    if (counted && owner) await moveCommentsCount(this.deps, input.target, 1);

    const created = await this.toThread(stored, ownOrPublicTo({ id: input.authorId }, scope));
    const told = await announceCreated(this.deps, { created, owner, input, counted });
    if (isErr(told)) return told;
    const recorded = await recordModeration(this.deps, audit && { audit });
    return isErr(recorded) ? recorded : ok(created);
  }

  async updateContent(
    id: string,
    content: string,
    edit: CommentEditWrite
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    const comment = this.liveById(id);
    if (!comment) return ok(null);

    const scope = this.scope();
    const read = () => this.toThread(comment, ownOrPublicTo({ id: comment.authorId }, scope));
    return editStored(this.deps, comment, this.repliesOf(id), scope, content, edit, read);
  }

  async remove(
    target: CommentLocator,
    record?: ModerationRecord & { removal?: NewCommentRemoval }
  ): Promise<Result<number, DatabaseUnavailable>> {
    const scope = this.scope();
    const comment = this.liveById(target.id);
    if (!comment) return ok(0);

    const removed =
      comment.parentId === null ? [comment, ...this.repliesOf(comment.id)] : [comment];
    const counted = removed.filter((row) => isVisibleTo(null, row, scope)).length;
    const now = new Date();
    for (const row of removed) Object.assign(row, { deletedAt: now, isPinned: false });
    await moveCommentsCount(this.deps, comment.target, -counted);
    if (record?.removal)
      this.removals.set(record.removal.id, { ...record.removal, createdAt: now });
    const recorded = await recordModeration(this.deps, record);
    return isErr(recorded) ? recorded : ok(removed.length);
  }

  async setPinned(
    target: CommentLocator,
    pinned: boolean,
    audit?: NewChannelAuditEntry
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    const comment = this.liveById(target.id);
    if (!comment) return ok(null);

    const scope = this.scope();
    for (const row of this.live()) {
      if (pinned && sameTarget(row.target, target.target)) row.isPinned = false;
    }
    Object.assign(comment, { isPinned: pinned, updatedAt: new Date() });
    const recorded = await recordModeration(this.deps, audit && { audit });
    return isErr(recorded)
      ? recorded
      : ok(await this.toThread(comment, ownOrPublicTo(null, scope)));
  }

  async setHearted(
    target: CommentLocator,
    hearted: boolean
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    const comment = this.liveById(target.id);
    if (!comment || !sameTarget(comment.target, target.target)) return ok(null);

    const scope = this.scope();
    const heart = await applyHeart(this.deps.outboxRepo, comment, hearted);
    return isErr(heart) ? heart : ok(await this.toThread(comment, ownOrPublicTo(null, scope)));
  }

  async listByAuthor(
    viewer: UserContext,
    options: ListAuthoredCommentsOptions
  ): Promise<Result<AuthoredComment[], DatabaseUnavailable>> {
    return ok(await listAuthored(this.deps, this.live(), viewer, options));
  }

  async listForOwner(
    ownerId: string,
    options: ListCreatorInboxOptions
  ): Promise<Result<CreatorInboxComment[], DatabaseUnavailable>> {
    return ok(
      await creatorInbox(this.deps, this.live(), ownerId, options, (rows) =>
        this.threadsOf(rows, () => true)
      )
    );
  }

  peek(id: string) {
    const comment = this.comments.get(id);
    if (!comment) return undefined;
    const { target, authorId, content, deletedAt } = comment;
    return { id, videoId: commentVideoId(target), authorId, content, removed: deletedAt !== null };
  }

  removeTarget(target: CommentTarget): void {
    removeTargetComments(this.comments, target);
  }

  clear(): void {
    this.comments.clear();
    this.removals.clear();
  }

  private live(): StoredComment[] {
    return standing(this.comments.values());
  }

  private liveById(id: string): StoredComment | undefined {
    return this.live().find((comment) => comment.id === id);
  }

  private repliesOf(rootId: string): StoredComment[] {
    return repliesOf(this.comments.values(), rootId);
  }

  private scope(channelIds: readonly string[] = []): PublicScopeContext {
    return publicScopeOf(this.comments, channelIds, {
      restrictions: this.deps.restrictionsRepo,
    });
  }

  private threadsOf(
    rows: readonly StoredComment[],
    countsReply: (reply: StoredComment) => boolean
  ) {
    return Promise.all(rows.map((row) => this.toThread(row, countsReply)));
  }

  private async toThread(
    stored: StoredComment,
    countsReply: (reply: StoredComment) => boolean
  ): Promise<CommentThread> {
    const channel = unwrapOr(await this.deps.channelsRepo.findById(stored.authorChannelId), null);
    return toThreadOf(stored, channel, this.repliesOf(stored.id).filter(countsReply).length);
  }
}
