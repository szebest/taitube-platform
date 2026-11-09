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
  type CommentThread,
  type CreatorInboxComment,
  type NewCommentInput,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { commentOutbox, heartOutbox } from '@vp/job-contracts';
import type { UserContext } from '@vp/permissions';
import { isErr, ok, type Result, unwrapOr } from '@vp/result';
import { announceCreated } from './comment-announce';
import { listAuthored } from './comment-authored';
import { inboxPage } from './comment-inbox-filter';
import { commentSortKey, compareKeys, rowKey, threadPage } from './comment-order';
import { newStoredComment, toThreadOf } from './comment-projections';
import {
  isVisibleTo,
  ownNonPublic,
  ownOrPublicTo,
  type PublicScopeContext,
  publicScopeOf,
} from './comment-public-scope';
import { repliesOf, standing, type StoredComment } from './comment-visibility';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';
import type { InMemoryChannelUserRestrictionRepository } from './in-memory-channel-user-restriction-repository';
import type { InMemoryCommentReportRepository } from './in-memory-comment-report-repository';
import type { InMemoryVideoRepository } from './in-memory-video-repository';

export interface InMemoryCommentRepositoryOptions {
  channelsRepo: InMemoryChannelRepository;
  videosRepo: InMemoryVideoRepository;
  outboxRepo: OutboxRepository;
  reportsRepo: InMemoryCommentReportRepository;
  userEventsRepo: UserEventRepository;
  restrictionsRepo: Pick<InMemoryChannelUserRestrictionRepository, 'shadowedUserIds'>;
}

/**
 * Every write takes its one await before touching state, so a burst of concurrent creates moves
 * the video counter the way the Postgres transaction does, with no half-step to observe.
 */
export class InMemoryCommentRepository implements CommentRepositoryPort {
  private readonly comments = new Map<string, StoredComment>();
  constructor(private readonly deps: InMemoryCommentRepositoryOptions) {}

  async findById(id: string): Promise<Result<Comment | null, DatabaseUnavailable>> {
    return ok(this.live().find((comment) => comment.id === id) ?? null);
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
    videoId: string,
    { viewer, sort, window }: ListCommentThreadsOptions
  ): Promise<Result<CommentThread[], DatabaseUnavailable>> {
    const scope = await this.scope([videoId]);
    const roots = this.live()
      .filter(
        (comment) =>
          comment.videoId === videoId &&
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
    const scope = await this.scope([root.videoId]);
    const replies = this.repliesOf(root.id)
      .filter((reply) => isVisibleTo(viewer, reply, scope))
      .sort((a, b) => compareKeys(rowKey(a), rowKey(b)))
      .filter((row) => !cursor || compareKeys(rowKey(row), rowKey(cursor)) > 0)
      .slice(0, limit + 1);

    return ok(await this.threadsOf(replies, ownOrPublicTo(viewer, scope)));
  }

  async listOwnNonPublic(
    videoId: string,
    authorId: string
  ): Promise<Result<CommentThread[], DatabaseUnavailable>> {
    const scope = await this.scope([videoId]);
    const mine = ownNonPublic(this.live(), videoId, authorId, scope);
    return ok(await this.threadsOf(mine, ownOrPublicTo({ id: authorId }, scope)));
  }

  async create(input: NewCommentInput): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    const video = unwrapOr(await this.deps.videosRepo.findById(input.videoId), null);
    const scope = await this.scope([input.videoId]);
    if (input.parentId !== null && !this.liveById(input.parentId)) return ok(null);
    const stored = newStoredComment(input, new Date());
    this.comments.set(stored.id, stored);
    const counted = isVisibleTo(null, stored, scope);
    if (counted && video) video.commentsCount = (video.commentsCount ?? 0) + 1;
    if (counted) {
      const enqueued = await this.deps.outboxRepo.enqueue(
        commentOutbox({ videoId: input.videoId, commentId: input.id })
      );
      if (isErr(enqueued)) return enqueued;
    }

    const created = await this.toThread(stored, ownOrPublicTo({ id: input.authorId }, scope));
    const announced = await announceCreated(this.deps.userEventsRepo, {
      created,
      video,
      input,
      counted,
    });
    if (isErr(announced)) return announced;
    return ok(created);
  }

  async updateContent(
    id: string,
    content: string
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    const comment = this.liveById(id);
    if (!comment) return ok(null);

    const scope = await this.scope([comment.videoId]);
    Object.assign(comment, { content, isEdited: true, updatedAt: new Date() });
    return ok(await this.toThread(comment, ownOrPublicTo({ id: comment.authorId }, scope)));
  }

  async remove(target: CommentLocator): Promise<Result<number, DatabaseUnavailable>> {
    const video = unwrapOr(await this.deps.videosRepo.findById(target.videoId), null);
    const scope = await this.scope([target.videoId]);
    const comment = this.liveById(target.id);
    if (!comment) return ok(0);

    const removed =
      comment.parentId === null ? [comment, ...this.repliesOf(comment.id)] : [comment];
    const counted = removed.filter((row) => isVisibleTo(null, row, scope)).length;
    const now = new Date();
    for (const row of removed) Object.assign(row, { deletedAt: now, isPinned: false });
    if (video) video.commentsCount = (video.commentsCount ?? 0) - counted;

    return ok(removed.length);
  }

  async setPinned(
    target: CommentLocator,
    pinned: boolean
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    const comment = this.liveById(target.id);
    if (!comment) return ok(null);

    const scope = await this.scope([target.videoId]);
    if (pinned) {
      for (const row of this.live()) {
        if (row.videoId === target.videoId && row.isPinned) row.isPinned = false;
      }
    }
    Object.assign(comment, { isPinned: pinned, updatedAt: new Date() });
    return ok(await this.toThread(comment, ownOrPublicTo(null, scope)));
  }

  async setHearted(
    target: CommentLocator,
    hearted: boolean
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    const comment = this.liveById(target.id);
    if (!comment || comment.videoId !== target.videoId) return ok(null);

    const scope = await this.scope([target.videoId]);
    if (!hearted) comment.heartedAt = null;
    else if (comment.heartedAt === null) {
      comment.heartedAt = new Date();
      const enqueued = await this.deps.outboxRepo.enqueue(
        heartOutbox({ videoId: target.videoId, commentId: target.id })
      );
      if (isErr(enqueued)) return enqueued;
    }
    return ok(await this.toThread(comment, ownOrPublicTo(null, scope)));
  }

  async listByAuthor(
    viewer: UserContext,
    options: ListAuthoredCommentsOptions
  ): Promise<Result<AuthoredComment[], DatabaseUnavailable>> {
    return ok(await listAuthored(this.deps, this.live(), viewer, options));
  }

  async listForOwner(
    ownerId: string,
    { filter, cursor, limit }: ListCreatorInboxOptions
  ): Promise<Result<CreatorInboxComment[], DatabaseUnavailable>> {
    const videos = new Map(
      this.deps.videosRepo
        .getAllVideos()
        .filter((video) => video.ownerId === ownerId && !video.deletedAt)
        .map((video) => [video.id, video])
    );
    const page = inboxPage(
      this.live(),
      videos,
      ownerId,
      { filter, cursor, limit },
      this.deps.reportsRepo
    );
    const rows = await this.threadsOf(page, () => true);
    return ok(
      rows.map((row) => ({
        ...row,
        video: { id: row.videoId, title: videos.get(row.videoId)?.title ?? '' },
      }))
    );
  }

  peek(id: string) {
    const comment = this.comments.get(id);
    if (!comment) return undefined;
    const { videoId, authorId, content, deletedAt } = comment;
    return { id, videoId, authorId, content, removed: deletedAt !== null };
  }

  clear(): void {
    this.comments.clear();
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

  private scope(videoIds: readonly string[]): Promise<PublicScopeContext> {
    return publicScopeOf(this.comments, videoIds, {
      videos: this.deps.videosRepo,
      channels: this.deps.channelsRepo,
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
    const channel = unwrapOr(await this.deps.channelsRepo.findByUserId(stored.authorId), null);
    return toThreadOf(stored, channel, this.repliesOf(stored.id).filter(countsReply).length);
  }
}
