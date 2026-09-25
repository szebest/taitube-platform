import type {
  CommentLocator,
  CommentRepositoryPort,
  CommentThreadCursor,
  ListCommentRepliesOptions,
  ListCommentThreadsOptions,
} from '@vp/core/repositories';
import type { Comment, CommentSort, CommentThread, NewCommentInput } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, assertNever, ok, unwrapOr } from '@vp/result';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';
import type { InMemoryVideoRepository } from './in-memory-video-repository';

interface StoredComment extends Comment {
  deletedAt: Date | null;
}

type SortKey = readonly (number | string)[];

export interface InMemoryCommentRepositoryOptions {
  channelsRepo: InMemoryChannelRepository;
  videosRepo: InMemoryVideoRepository;
}

function sortKey(sort: CommentSort, row: CommentThreadCursor): SortKey {
  const pinned = row.isPinned ? 1 : 0;
  switch (sort) {
    case 'top':
      return [pinned, row.likeCount, row.createdAt.getTime(), row.id];
    case 'newest':
      return [pinned, row.createdAt.getTime(), row.id];
    default:
      return assertNever(sort, 'CommentSort');
  }
}

function compareKeys(a: SortKey, b: SortKey): number {
  for (let i = 0; i < a.length; i++) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left < right) return -1;
    if (left > right) return 1;
  }
  return 0;
}

/**
 * Every write takes its one await before touching state, so a burst of concurrent creates moves
 * the video counter the way the Postgres transaction does, with no half-step to observe.
 */
export class InMemoryCommentRepository implements CommentRepositoryPort {
  private readonly comments = new Map<string, StoredComment>();
  private readonly channelsRepo: InMemoryChannelRepository;
  private readonly videosRepo: InMemoryVideoRepository;

  constructor(options: InMemoryCommentRepositoryOptions) {
    this.channelsRepo = options.channelsRepo;
    this.videosRepo = options.videosRepo;
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
      .sort((a, b) => compareKeys(sortKey(sort, b), sortKey(sort, a)));

    const page = (() => {
      switch (window.type) {
        case 'keyset': {
          const { cursor } = window;
          const after = cursor
            ? roots.filter((row) => compareKeys(sortKey(sort, row), sortKey(sort, cursor)) < 0)
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

  async create(input: NewCommentInput): Promise<Result<CommentThread, DatabaseUnavailable>> {
    const video = unwrapOr(await this.videosRepo.findById(input.videoId), null);
    const now = new Date();
    const stored: StoredComment = {
      ...input,
      isPinned: false,
      isEdited: false,
      likeCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.comments.set(stored.id, stored);
    if (video) video.commentsCount = (video.commentsCount ?? 0) + 1;

    return ok(await this.toThread(stored));
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

  clear(): void {
    this.comments.clear();
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
