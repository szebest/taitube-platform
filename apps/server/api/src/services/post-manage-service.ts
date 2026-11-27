import type { CursorPayload, InvalidCursor, Paginator } from '@kit/pagination';
import { type Result, andThen, err, isErr, ok } from '@kit/result';
import type { ManagedPostPageView, ManagedPostView, PostStatsView } from '@vp/api-contracts';
import type {
  ChannelPostRepositoryPort,
  PostEngagementRepositoryPort,
} from '@vp/core/repositories';
import type { ActingChannel, ChannelPost, PostStatus } from '@vp/domain';
import { POSTS_PINNED_LIMIT } from '@vp/domain';
import {
  type AuthorizationFailure,
  type PostNotFound,
  type PostPinLimit,
  decidePostStatsRead,
  decidePostTarget,
  decidePostWrite,
  postNotFound,
  postPinLimit,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { asDate, asId, decodeWith, isoOf } from './cursor';
import { postAuditOf } from './post-audit';
import { toManagedPostViews } from './post-managed-views';
import type { PostViewDeps } from './post-views';

export interface PostManageServiceDeps extends PostViewDeps {
  posts: ChannelPostRepositoryPort;
  engagement: PostEngagementRepositoryPort;
  paginator: Paginator;
  now: () => number;
}

export interface ManagedPostQuery {
  status?: PostStatus;
  cursor?: string;
  limit?: number;
}

type ManageFailure = AuthorizationFailure | PostNotFound | DatabaseUnavailable;

const cursorOf = (post: ChannelPost): CursorPayload => ({
  createdAt: isoOf(post.createdAt),
  id: post.id,
});

/** The team's side of a channel's posts: the studio list, pinning and the stats. */
export class PostManageService {
  constructor(private readonly deps: PostManageServiceDeps) {}

  async list(
    user: UserContext,
    acting: ActingChannel,
    query: ManagedPostQuery
  ): Promise<
    Result<ManagedPostPageView, AuthorizationFailure | InvalidCursor | DatabaseUnavailable>
  > {
    const { paginator, posts } = this.deps;
    const channel = { id: acting.channelId, ownerId: acting.ownerId };
    const allowed = decidePostWrite({ actor: user, action: 'create', channel });
    if (isErr(allowed)) return allowed;
    const cursor = decodeWith(query.cursor, paginator, (payload) =>
      andThen(asDate(payload['createdAt']), (createdAt) =>
        andThen(asId(payload['id']), (id) => ok({ createdAt, id }))
      )
    );
    if (isErr(cursor)) return cursor;

    const limit = paginator.limit(query.limit);
    const found = await posts.listManaged(channel.id, {
      status: query.status ?? null,
      cursor: cursor.value,
      limit,
    });
    if (isErr(found)) return found;
    const page = paginator.paginate(found.value, limit, { cursorOf, toItem: (post) => post });
    const views = await toManagedPostViews(this.deps, page.items, { user, now: this.now() });
    return andThen(views, (items) => ok({ items, nextCursor: page.nextCursor }));
  }

  async pin(
    user: UserContext,
    acting: ActingChannel,
    postId: string
  ): Promise<Result<ManagedPostView, ManageFailure | PostPinLimit>> {
    return this.setPinned(user, acting, postId, true);
  }

  async unpin(
    user: UserContext,
    acting: ActingChannel,
    postId: string
  ): Promise<Result<ManagedPostView, ManageFailure | PostPinLimit>> {
    return this.setPinned(user, acting, postId, false);
  }

  async stats(
    user: UserContext,
    acting: ActingChannel,
    postId: string
  ): Promise<Result<PostStatsView, ManageFailure>> {
    const channel = { id: acting.channelId, ownerId: acting.ownerId };
    const allowed = decidePostStatsRead({ actor: user, channel });
    if (isErr(allowed)) return allowed;
    const owned = await this.targetOf(postId, channel.id);
    if (isErr(owned)) return owned;
    const stats = await this.deps.engagement.stats(postId);
    if (isErr(stats)) return stats;
    return stats.value ? ok(stats.value) : err(postNotFound(postId));
  }

  private async setPinned(
    user: UserContext,
    acting: ActingChannel,
    postId: string,
    pinned: boolean
  ): Promise<Result<ManagedPostView, ManageFailure | PostPinLimit>> {
    const channel = { id: acting.channelId, ownerId: acting.ownerId };
    const allowed = decidePostWrite({ actor: user, action: 'pin', channel });
    if (isErr(allowed)) return allowed;
    const target = await this.targetOf(postId, channel.id);
    if (isErr(target)) return target;

    const outcome = await this.deps.posts.setPinned(
      postId,
      channel.id,
      pinned,
      POSTS_PINNED_LIMIT,
      postAuditOf('post.updated', user, channel.id, target.value)
    );
    if (isErr(outcome)) return outcome;
    if (outcome.value === 'limit') return err(postPinLimit(POSTS_PINNED_LIMIT));
    if (outcome.value === 'missing' || outcome.value === 'not_published') {
      return err(postNotFound(postId));
    }
    const fresh = await this.targetOf(postId, channel.id);
    if (isErr(fresh)) return fresh;
    const views = await toManagedPostViews(this.deps, [fresh.value], { user, now: this.now() });
    if (isErr(views)) return views;
    const [view] = views.value;
    return view ? ok(view) : err(postNotFound(postId));
  }

  private async targetOf(
    postId: string,
    channelId: string
  ): Promise<Result<ChannelPost, PostNotFound | DatabaseUnavailable>> {
    const found = await this.deps.posts.findById(postId);
    if (isErr(found)) return found;
    return decidePostTarget({ post: found.value, postId, channelId });
  }

  private now(): Date {
    return new Date(this.deps.now());
  }
}
