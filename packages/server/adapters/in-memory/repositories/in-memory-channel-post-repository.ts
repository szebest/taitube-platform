import type { DatabaseUnavailable } from '@kit/errors';
import { isErr, ok, type Result } from '@kit/result';
import type {
  ChannelPostCreated,
  ChannelPostEdit,
  EntityRevisionRepository,
  PostWriteLimits,
  ChannelPostEdited,
  ChannelPostRepositoryPort,
  ListChannelPostsOptions,
  ListManagedPostsOptions,
  OutboxRepository,
  PostLikeWritten,
} from '@vp/core/repositories';
import {
  isPostPublished,
  type ChannelPost,
  type ChannelPostEntry,
  type CommentTarget,
  type NewChannelAuditEntry,
  type NewChannelPostInput,
  type NewPostInput,
  type NewUnpublishedPostInput,
  type PostPinOutcome,
} from '@vp/domain';
import { decidePollUnlocked } from '@vp/domain-rules';
import { postSubscribersOutbox } from '@vp/job-contracts';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import {
  dueScheduled,
  managedPage,
  newUnpublishedPost,
  pinnedCount,
  publishedPage,
} from './in-memory-post-queries';
import { limitRefusal, recordPostRevisions } from './in-memory-post-revisions';
import type { InMemorySubscriptionRepository } from './in-memory-subscription-repository';

export interface InMemoryChannelPostRepositoryOptions {
  auditRepo: Pick<InMemoryChannelAuditRepository, 'append'>;
  outboxRepo: Pick<OutboxRepository, 'enqueue'>;
  subscriptionsRepo: Pick<InMemorySubscriptionRepository, 'getChannelSubscriptionChannelIds'>;
  /** The votes a post holds, which lock its poll. */
  votes: (postId: string) => number;
  revisions: Pick<EntityRevisionRepository, 'append' | 'list'>;
  /** The in-memory form of the trigger that deletes a target's comments with it. */
  removeComments: (target: CommentTarget) => void;
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
    { payload, commentsEnabled, placement, revision }: ChannelPostEdit,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelPostEdited, DatabaseUnavailable>> {
    const post = this.posts.get(id);
    if (!post) return ok({ type: 'missing' });
    if (post.version !== version) return ok({ type: 'stale', version: post.version });
    const unlocked = decidePollUnlocked({ post, next: payload, voteCount: this.deps.votes(id) });
    if (!unlocked.ok) return ok({ type: 'locked' });

    const before = { ...post };
    Object.assign(post, {
      payload,
      commentsEnabled,
      ...placement,
      editedAt: new Date(),
      version: version + 1,
    });
    if (isPostPublished(before.status)) {
      const recorded = await recordPostRevisions(this.deps.revisions, before, post, revision);
      if (isErr(recorded)) return recorded;
    }
    const audited = await this.deps.auditRepo.append(audit);
    return isErr(audited) ? audited : ok({ type: 'edited', post: { ...post } });
  }

  async create(
    input: NewPostInput,
    audit: NewChannelAuditEntry,
    limits: PostWriteLimits
  ): Promise<Result<ChannelPostCreated, DatabaseUnavailable>> {
    const refused = limitRefusal([...this.posts.values()], input, limits);
    if (refused) return ok(refused);
    const written = isPostPublished(input.status)
      ? await this.publish(input, audit)
      : await this.saveUnpublished(
          { ...input, status: input.status as 'draft' | 'scheduled' },
          audit
        );
    return isErr(written) ? written : ok({ type: 'created', post: written.value });
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

  async countPending(channelId: string): Promise<Result<number, DatabaseUnavailable>> {
    return ok(
      [...this.posts.values()].filter(
        (post) => post.channelId === channelId && !isPostPublished(post.status)
      ).length
    );
  }

  async saveUnpublished(
    input: NewUnpublishedPostInput,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelPost, DatabaseUnavailable>> {
    const post = newUnpublishedPost(input);
    this.posts.set(post.id, post);
    const audited = await this.deps.auditRepo.append(audit);
    return isErr(audited) ? audited : ok({ ...post });
  }

  async promote(
    id: string,
    audit: NewChannelAuditEntry | null
  ): Promise<Result<ChannelPost | null, DatabaseUnavailable>> {
    const post = this.posts.get(id);
    if (!post || isPostPublished(post.status)) return ok(null);
    Object.assign(post, {
      status: 'published',
      publishedAt: new Date(),
      publishAt: null,
      editedAt: null,
      version: post.version + 1,
    });
    if (audit) {
      const audited = await this.deps.auditRepo.append(audit);
      if (isErr(audited)) return audited;
    }
    const enqueued = await this.deps.outboxRepo.enqueue(postSubscribersOutbox({ postId: id }));
    return isErr(enqueued) ? enqueued : ok({ ...post });
  }

  async promoteDue(now: Date, limit: number): Promise<Result<string[], DatabaseUnavailable>> {
    const due = dueScheduled([...this.posts.values()], now, limit);
    const promoted: string[] = [];
    for (const { id } of due) {
      const result = await this.promote(id, null);
      if (isErr(result)) return result;
      if (result.value) promoted.push(id);
    }
    return ok(promoted);
  }

  async listManaged(
    channelId: string,
    options: ListManagedPostsOptions
  ): Promise<Result<ChannelPost[], DatabaseUnavailable>> {
    return ok(managedPage([...this.posts.values()], channelId, options));
  }

  async setPinned(
    id: string,
    channelId: string,
    pinned: boolean,
    limit: number,
    audit: NewChannelAuditEntry
  ): Promise<Result<PostPinOutcome, DatabaseUnavailable>> {
    const post = this.posts.get(id);
    if (post?.channelId !== channelId) return ok('missing');
    if (!isPostPublished(post.status)) return ok('not_published');
    if (pinned === (post.pinnedAt !== null)) return ok(pinned ? 'pinned' : 'unpinned');
    if (pinned && pinnedCount([...this.posts.values()], channelId) >= limit) return ok('limit');
    post.pinnedAt = pinned ? new Date() : null;
    const audited = await this.deps.auditRepo.append(audit);
    return isErr(audited) ? audited : ok(pinned ? 'pinned' : 'unpinned');
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
    options: ListChannelPostsOptions,
    ordered?: (post: ChannelPost) => ChannelPost
  ): ChannelPostEntry[] {
    return publishedPage(this.posts, this.likes, belongs, options, ordered);
  }
}
