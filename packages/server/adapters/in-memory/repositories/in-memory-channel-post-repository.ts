import { isErr, ok, type Result } from '@kit/result';
import type {
  ChannelPostEdit,
  ChannelPostEdited,
  ChannelPostRepositoryPort,
  ListChannelPostsOptions,
  OutboxRepository,
  PostLikeWritten,
} from '@vp/core/repositories';
import type {
  ChannelPost,
  ChannelPostCursor,
  ChannelPostEntry,
  CommentTarget,
  NewChannelAuditEntry,
  NewChannelPostInput,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { postSubscribersOutbox } from '@vp/job-contracts';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import type { InMemorySubscriptionRepository } from './in-memory-subscription-repository';

export interface InMemoryChannelPostRepositoryOptions {
  auditRepo: Pick<InMemoryChannelAuditRepository, 'append'>;
  outboxRepo: Pick<OutboxRepository, 'enqueue'>;
  subscriptionsRepo: Pick<InMemorySubscriptionRepository, 'getChannelSubscriptionChannelIds'>;
  /** The in-memory form of the trigger that deletes a target's comments with it. */
  removeComments: (target: CommentTarget) => void;
}

/** Pinned first by pin time, then newest, the id breaking ties; every part descends. */
function orderKey({ pinnedAt, publishedAt, id }: ChannelPostCursor): readonly (number | string)[] {
  return [pinnedAt?.getTime() ?? -1, publishedAt.getTime(), id];
}

function compareDesc(a: ChannelPostCursor, b: ChannelPostCursor): number {
  const left = orderKey(a);
  const right = orderKey(b);
  const at = left.findIndex((part, index) => part !== right[index]);
  if (at === -1) return 0;
  return (left[at] ?? 0) > (right[at] ?? 0) ? -1 : 1;
}

function cursorOf(post: ChannelPost): ChannelPostCursor | null {
  return (
    post.publishedAt && { pinnedAt: post.pinnedAt, publishedAt: post.publishedAt, id: post.id }
  );
}

export class InMemoryChannelPostRepository implements ChannelPostRepositoryPort {
  /** Read by the comment repositories, which move a post's `commentsCount`. */
  readonly posts = new Map<string, ChannelPost>();
  private readonly likes = new Set<string>();

  constructor(private readonly deps: InMemoryChannelPostRepositoryOptions) {}

  async findById(id: string): Promise<Result<ChannelPost | null, DatabaseUnavailable>> {
    const post = this.posts.get(id);
    return ok(post ? { ...post } : null);
  }

  async countCreatedSince(
    channelId: string,
    since: Date
  ): Promise<Result<number, DatabaseUnavailable>> {
    return ok(
      [...this.posts.values()].filter(
        (post) => post.channelId === channelId && post.createdAt >= since
      ).length
    );
  }

  async publish(
    input: NewChannelPostInput,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelPost, DatabaseUnavailable>> {
    const now = new Date();
    const post: ChannelPost = {
      ...input,
      status: 'published',
      publishAt: null,
      publishedAt: now,
      pinnedAt: null,
      editedAt: null,
      likeCount: 0,
      commentsCount: 0,
      version: 1,
      createdAt: now,
    };
    this.posts.set(post.id, post);
    const audited = await this.deps.auditRepo.append(audit);
    if (isErr(audited)) return audited;
    const enqueued = await this.deps.outboxRepo.enqueue(postSubscribersOutbox({ postId: post.id }));
    return isErr(enqueued) ? enqueued : ok({ ...post });
  }

  async edit(
    id: string,
    version: number,
    { payload, commentsEnabled }: ChannelPostEdit,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelPostEdited, DatabaseUnavailable>> {
    const post = this.posts.get(id);
    if (!post) return ok({ type: 'missing' });
    if (post.version !== version) return ok({ type: 'stale', version: post.version });

    Object.assign(post, { payload, commentsEnabled, editedAt: new Date(), version: version + 1 });
    const audited = await this.deps.auditRepo.append(audit);
    return isErr(audited) ? audited : ok({ type: 'edited', post: { ...post } });
  }

  async remove(
    id: string,
    audit: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    if (!this.posts.delete(id)) return ok(false);
    for (const key of [...this.likes]) if (key.startsWith(`${id}:`)) this.likes.delete(key);
    this.deps.removeComments({ type: 'post', id });
    const audited = await this.deps.auditRepo.append(audit);
    return isErr(audited) ? audited : ok(true);
  }

  async listPublished(
    channelId: string,
    options: ListChannelPostsOptions
  ): Promise<Result<ChannelPostEntry[], DatabaseUnavailable>> {
    return ok(this.page((post) => post.channelId === channelId, options));
  }

  async listFeed(
    subscriberChannelId: string,
    options: ListChannelPostsOptions
  ): Promise<Result<ChannelPostEntry[], DatabaseUnavailable>> {
    const followed =
      await this.deps.subscriptionsRepo.getChannelSubscriptionChannelIds(subscriberChannelId);
    if (isErr(followed)) return followed;
    const channels = new Set(followed.value);
    const unpinned = {
      ...options,
      cursor: options.cursor && { ...options.cursor, pinnedAt: null },
    };
    return ok(
      this.page(
        (post) => channels.has(post.channelId),
        unpinned,
        (post) => ({
          ...post,
          pinnedAt: null,
        })
      )
    );
  }

  async isLiked(postId: string, userId: string): Promise<Result<boolean, DatabaseUnavailable>> {
    return ok(this.likes.has(`${postId}:${userId}`));
  }

  async setLiked(
    postId: string,
    userId: string,
    liked: boolean
  ): Promise<Result<PostLikeWritten | null, DatabaseUnavailable>> {
    const post = this.posts.get(postId);
    if (!post) return ok(null);
    const key = `${postId}:${userId}`;
    if (liked !== this.likes.has(key)) {
      if (liked) this.likes.add(key);
      else this.likes.delete(key);
      post.likeCount += liked ? 1 : -1;
    }
    return ok({ liked, likeCount: post.likeCount });
  }

  clear(): void {
    this.posts.clear();
    this.likes.clear();
  }

  private page(
    belongs: (post: ChannelPost) => boolean,
    { viewerId, cursor, limit }: ListChannelPostsOptions,
    ordered: (post: ChannelPost) => ChannelPost = (post) => post
  ): ChannelPostEntry[] {
    return [...this.posts.values()]
      .filter((post) => post.status === 'published' && belongs(post))
      .map(ordered)
      .flatMap((post) => {
        const key = cursorOf(post);
        return key && (!cursor || compareDesc(key, cursor) > 0) ? [{ post, key }] : [];
      })
      .sort((a, b) => compareDesc(a.key, b.key))
      .slice(0, limit + 1)
      .map(({ post }) => ({
        post: { ...(this.posts.get(post.id) ?? post) },
        likedByViewer: viewerId !== null && this.likes.has(`${post.id}:${viewerId}`),
      }));
  }
}
