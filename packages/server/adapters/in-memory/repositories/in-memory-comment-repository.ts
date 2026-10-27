import type {
  CommentLocator,
  CommentRepositoryPort,
  ListCommentRepliesOptions,
  ListCommentThreadsOptions,
  ListCreatorInboxOptions,
  OutboxRepository,
  UserEventRepository,
} from '@vp/core/repositories';
import {
  type Comment,
  type CommentThread,
  type CreatorInboxComment,
  commentCreated,
  type NewCommentInput,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { commentOutbox, heartOutbox } from '@vp/job-contracts';
import { assertNever, isErr, ok, type Result, unwrapOr } from '@vp/result';
import { commentSortKey, compareKeys, type SortKey } from './comment-order';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';
import type { InMemoryCommentReportRepository } from './in-memory-comment-report-repository';
import type { InMemoryVideoRepository } from './in-memory-video-repository';

interface StoredComment extends Comment {
  deletedAt: Date | null;
}

export interface InMemoryCommentRepositoryOptions {
  channelsRepo: InMemoryChannelRepository;
  videosRepo: InMemoryVideoRepository;
  outboxRepo: OutboxRepository;
  reportsRepo: InMemoryCommentReportRepository;
  userEventsRepo: UserEventRepository;
}

/**
 * Every write takes its one await before touching state, so a burst of concurrent creates moves
 * the video counter the way the Postgres transaction does, with no half-step to observe.
 */
export class InMemoryCommentRepository implements CommentRepositoryPort {
  private readonly comments = new Map<string, StoredComment>();
  private readonly channelsRepo: InMemoryChannelRepository;
  private readonly videosRepo: InMemoryVideoRepository;
  private readonly outboxRepo: OutboxRepository;
  private readonly reportsRepo: InMemoryCommentReportRepository;
  private readonly userEventsRepo: UserEventRepository;

  constructor(options: InMemoryCommentRepositoryOptions) {
    this.channelsRepo = options.channelsRepo;
    this.videosRepo = options.videosRepo;
    this.outboxRepo = options.outboxRepo;
    this.reportsRepo = options.reportsRepo;
    this.userEventsRepo = options.userEventsRepo;
  }

  async findById(id: string): Promise<Result<Comment | null, DatabaseUnavailable>> {
    return ok(this.live().find((comment) => comment.id === id) ?? null);
  }

  async listThreads(
    videoId: string,
    { sort, window }: ListCommentThreadsOptions
  ): Promise<Result<CommentThread[], DatabaseUnavailable>> {
    const roots = this.live()
      .filter((comment) => comment.videoId === videoId && comment.parentId === null)
      .sort((a, b) => compareKeys(commentSortKey(sort, b), commentSortKey(sort, a)));

    const page = (() => {
      switch (window.type) {
        case 'keyset': {
          const { cursor } = window;
          const after = cursor
            ? roots.filter(
                (row) => compareKeys(commentSortKey(sort, row), commentSortKey(sort, cursor)) < 0
              )
            : roots;
          return after.slice(0, window.limit + 1);
        }
        case 'offset':
          return roots.slice(window.offset, window.offset + window.limit + 1);
        default:
          return assertNever(window, 'CommentWindow');
      }
    })();

    return ok(await Promise.all(page.map((comment) => this.toThread(comment))));
  }

  async listReplies(
    root: CommentLocator,
    { cursor, limit }: ListCommentRepliesOptions
  ): Promise<Result<CommentThread[], DatabaseUnavailable>> {
    const key = (row: { createdAt: Date; id: string }): SortKey => [
      row.createdAt.getTime(),
      row.id,
    ];
    const replies = this.repliesOf(root.id)
      .sort((a, b) => compareKeys(key(a), key(b)))
      .filter((row) => !cursor || compareKeys(key(row), key(cursor)) > 0)
      .slice(0, limit + 1);

    return ok(await Promise.all(replies.map((comment) => this.toThread(comment))));
  }

  async create(input: NewCommentInput): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    const video = unwrapOr(await this.videosRepo.findById(input.videoId), null);
    if (input.parentId !== null && !this.liveById(input.parentId)) return ok(null);
    const now = new Date();
    const stored: StoredComment = {
      ...input,
      isPinned: false,
      isEdited: false,
      likeCount: 0,
      heartedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.comments.set(stored.id, stored);
    if (video) video.commentsCount = (video.commentsCount ?? 0) + 1;
    const enqueued = await this.outboxRepo.enqueue(
      commentOutbox({ videoId: input.videoId, commentId: input.id })
    );
    if (isErr(enqueued)) return enqueued;

    const created = await this.toThread(stored);
    if (video && video.ownerId !== input.authorId) {
      const announced = await this.userEventsRepo.append({
        userId: video.ownerId,
        ...commentCreated(created, { id: video.id, title: video.title ?? '' }),
      });
      if (isErr(announced)) return announced;
    }
    return ok(created);
  }

  async updateContent(
    id: string,
    content: string
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    const comment = this.liveById(id);
    if (!comment) return ok(null);

    Object.assign(comment, { content, isEdited: true, updatedAt: new Date() });
    return ok(await this.toThread(comment));
  }

  async remove(target: CommentLocator): Promise<Result<number, DatabaseUnavailable>> {
    const video = unwrapOr(await this.videosRepo.findById(target.videoId), null);
    const comment = this.liveById(target.id);
    if (!comment) return ok(0);

    const removed =
      comment.parentId === null ? [comment, ...this.repliesOf(comment.id)] : [comment];
    const now = new Date();
    for (const row of removed) Object.assign(row, { deletedAt: now, isPinned: false });
    if (video) video.commentsCount = Math.max(0, (video.commentsCount ?? 0) - removed.length);

    return ok(removed.length);
  }

  async setPinned(
    target: CommentLocator,
    pinned: boolean
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    const comment = this.liveById(target.id);
    if (!comment) return ok(null);

    if (pinned) {
      for (const row of this.live()) {
        if (row.videoId === target.videoId && row.isPinned) row.isPinned = false;
      }
    }
    Object.assign(comment, { isPinned: pinned, updatedAt: new Date() });
    return ok(await this.toThread(comment));
  }

  async setHearted(
    target: CommentLocator,
    hearted: boolean
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    const comment = this.liveById(target.id);
    if (!comment || comment.videoId !== target.videoId) return ok(null);

    if (!hearted) comment.heartedAt = null;
    else if (comment.heartedAt === null) {
      comment.heartedAt = new Date();
      const enqueued = await this.outboxRepo.enqueue(
        heartOutbox({ videoId: target.videoId, commentId: target.id })
      );
      if (isErr(enqueued)) return enqueued;
    }
    return ok(await this.toThread(comment));
  }

  async listForOwner(
    ownerId: string,
    { filter, cursor, limit }: ListCreatorInboxOptions
  ): Promise<Result<CreatorInboxComment[], DatabaseUnavailable>> {
    const videos = new Map(
      this.videosRepo
        .getAllVideos()
        .filter((video) => video.ownerId === ownerId && !video.deletedAt)
        .map((video) => [video.id, video])
    );
    const key = (row: { createdAt: Date; id: string }): SortKey => [
      row.createdAt.getTime(),
      row.id,
    ];

    const page = this.live()
      .filter((comment) => videos.has(comment.videoId) && comment.authorId !== ownerId)
      .filter((comment) => this.matchesInbox(comment, filter, ownerId))
      .sort((a, b) => compareKeys(key(b), key(a)))
      .filter((row) => !cursor || compareKeys(key(row), key(cursor)) < 0)
      .slice(0, limit + 1);

    return ok(
      await Promise.all(
        page.map(async (comment) => {
          const video = videos.get(comment.videoId);
          return {
            ...(await this.toThread(comment)),
            video: { id: comment.videoId, title: video?.title ?? '' },
          };
        })
      )
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

  private matchesInbox(
    comment: StoredComment,
    filter: ListCreatorInboxOptions['filter'],
    ownerId: string
  ): boolean {
    switch (filter) {
      case 'all':
        return true;
      case 'unanswered': {
        const threadRoot = comment.parentId ?? comment.id;
        return !this.live().some(
          (other) =>
            other.parentId === threadRoot &&
            other.authorId === ownerId &&
            compareKeys(
              [other.createdAt.getTime(), other.id],
              [comment.createdAt.getTime(), comment.id]
            ) > 0
        );
      }
      case 'reported':
        return this.reportsRepo.hasOpenReport(comment.id);
      default:
        return assertNever(filter, 'CreatorInboxFilter');
    }
  }

  private live(): StoredComment[] {
    return Array.from(this.comments.values()).filter((comment) => comment.deletedAt === null);
  }

  private liveById(id: string): StoredComment | undefined {
    return this.live().find((comment) => comment.id === id);
  }

  private repliesOf(rootId: string): StoredComment[] {
    return this.live().filter((comment) => comment.parentId === rootId);
  }

  private async toThread(stored: StoredComment): Promise<CommentThread> {
    const { deletedAt: _deletedAt, ...comment } = stored;
    const channel = unwrapOr(await this.channelsRepo.findByUserId(comment.authorId), null);
    return {
      ...comment,
      author: {
        userId: comment.authorId,
        channelId: channel?.id ?? null,
        handle: channel?.handle ?? null,
        displayName: channel?.displayName ?? null,
        avatarUrl: channel?.avatarUrl ?? null,
      },
      replyCount: this.repliesOf(comment.id).length,
    };
  }
}
