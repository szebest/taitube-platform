import type { DatabaseUnavailable } from '@kit/errors';
import type { CursorPayload, InvalidCursor, Page, Paginator } from '@kit/pagination';
import { type Result, err, ignore, isErr, map, ok } from '@kit/result';
import type { ManagedPostView, PostLikeView, PostPageView, PostView } from '@vp/api-contracts';
import type { CommentCachePort } from '@vp/core/ports';
import type { ChannelPostRepositoryPort, ChannelRepositoryPort } from '@vp/core/repositories';
import type { ActingChannel, ChannelPost, ChannelPostEntry } from '@vp/domain';
import {
  type AuthorizationFailure,
  type ChannelNotFound,
  type PostNotFound,
  decideChannelTask,
  decidePostReact,
  decidePostRead,
  decidePostTarget,
  decidePostWrite,
  postNotFound,
} from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';
import { findChannelByIdOrHandle } from './channel-lookup';
import { postAuditOf } from './post-audit';
import { type CreatePostBody, type CreatePostServiceFailure, createPost } from './post-create';
import {
  channelPostCursorPayload,
  decodeChannelPostCursor,
  decodeFeedPostCursor,
  feedPostCursorPayload,
} from './post-cursor';
import { type EditPostBody, type EditPostServiceFailure, editPost } from './post-edit';
import { type PostViewDeps, toPostViews } from './post-views';

export interface PostServiceDeps extends PostViewDeps {
  posts: ChannelPostRepositoryPort;
  channels: ChannelRepositoryPort;
  commentCache: CommentCachePort;
  paginator: Paginator;
  now: () => number;
}

export interface PostPageQuery {
  cursor?: string;
  limit?: number;
}

type ReadFailure = PostNotFound | DatabaseUnavailable;

/** A channel's posts: what a reader sees, what the team publishes, and the likes on them. */
export class PostService {
  constructor(private readonly deps: PostServiceDeps) {}

  async listByChannel(
    viewer: UserContext | null,
    idOrHandle: string,
    query: PostPageQuery
  ): Promise<Result<PostPageView, ChannelNotFound | InvalidCursor | DatabaseUnavailable>> {
    const { paginator, posts } = this.deps;
    const channel = await findChannelByIdOrHandle(this.deps.channels, idOrHandle);
    if (isErr(channel)) return channel;
    const cursor = decodeChannelPostCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const limit = paginator.limit(query.limit);
    const found = await posts.listPublished(channel.value.id, {
      viewerId: viewer?.id ?? null,
      cursor: cursor.value,
      limit,
    });
    return this.page(found, limit, channelPostCursorPayload, viewer);
  }

  async get(viewer: UserContext | null, postId: string): Promise<Result<PostView, ReadFailure>> {
    const post = await this.readable(postId);
    if (isErr(post)) return post;
    const liked = viewer ? await this.deps.posts.isLiked(postId, viewer.id) : ok(false);
    if (isErr(liked)) return liked;
    return this.viewOf({ post: post.value, likedByViewer: liked.value }, viewer);
  }

  async create(
    user: UserContext,
    acting: ActingChannel,
    body: CreatePostBody
  ): Promise<Result<ManagedPostView, CreatePostServiceFailure>> {
    return createPost(this.deps, user, acting, body);
  }

  async edit(
    user: UserContext,
    acting: ActingChannel,
    postId: string,
    body: EditPostBody
  ): Promise<Result<ManagedPostView, EditPostServiceFailure>> {
    return editPost(this.deps, user, acting, postId, body);
  }

  async remove(
    user: UserContext,
    acting: ActingChannel,
    postId: string
  ): Promise<Result<void, AuthorizationFailure | PostNotFound | DatabaseUnavailable>> {
    const { posts } = this.deps;
    const channel = { id: acting.channelId, ownerId: acting.ownerId };
    const allowed = decidePostWrite({ actor: user, action: 'delete', channel });
    if (isErr(allowed)) return allowed;
    const found = await posts.findById(postId);
    if (isErr(found)) return found;
    const target = decidePostTarget({ post: found.value, postId, channelId: channel.id });
    if (isErr(target)) return target;

    const removed = await posts.remove(
      postId,
      postAuditOf('post.deleted', user, channel.id, target.value)
    );
    if (isErr(removed)) return removed;
    if (!removed.value) return err(postNotFound(postId));

    ignore(
      await this.deps.commentCache.invalidate({ type: 'post', id: postId }),
      'the post and its comments are gone; the hot page expires on its own TTL'
    );
    return ok(undefined);
  }

  async setLiked(
    user: UserContext,
    postId: string,
    liked: boolean
  ): Promise<Result<PostLikeView, AuthorizationFailure | ReadFailure>> {
    const reactor = decidePostReact(user);
    if (isErr(reactor)) return reactor;
    const post = await this.readable(postId);
    if (isErr(post)) return post;
    const written = await this.deps.posts.setLiked(postId, user.id, liked);
    if (isErr(written)) return written;
    if (!written.value) return err(postNotFound(postId));
    return ok({ postId, ...written.value });
  }

  async communityFeed(
    user: UserContext,
    acting: ActingChannel,
    query: PostPageQuery
  ): Promise<Result<PostPageView, AuthorizationFailure | InvalidCursor | DatabaseUnavailable>> {
    const { paginator, posts } = this.deps;
    const allowed = decideChannelTask({ user, acting, task: 'subscribe-as' });
    if (isErr(allowed)) return allowed;
    const cursor = decodeFeedPostCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const limit = paginator.limit(query.limit);
    const found = await posts.listFeed(acting.channelId, {
      viewerId: user.id,
      cursor: cursor.value,
      limit,
    });
    return this.page(found, limit, feedPostCursorPayload, user);
  }

  /** The post a reader may see, or the failure that says it is not there. */
  async channelOf(postId: string): Promise<Result<ChannelPost, ReadFailure>> {
    return this.readable(postId);
  }

  private viewerOf(user: UserContext | null) {
    return { user, now: new Date(this.deps.now()) };
  }

  private async readable(postId: string): Promise<Result<ChannelPost, ReadFailure>> {
    const found = await this.deps.posts.findById(postId);
    if (isErr(found)) return found;
    return decidePostRead({ post: found.value, postId });
  }

  private async viewOf(
    entry: ChannelPostEntry,
    viewer: UserContext | null
  ): Promise<Result<PostView, ReadFailure>> {
    const views = await toPostViews(this.deps, [entry], this.viewerOf(viewer));
    if (isErr(views)) return views;
    const [view] = views.value;
    return view ? ok(view) : err(postNotFound(entry.post.id));
  }

  private async page(
    found: Result<ChannelPostEntry[], DatabaseUnavailable>,
    limit: number,
    cursorOf: (entry: ChannelPostEntry) => CursorPayload,
    viewer: UserContext | null
  ): Promise<Result<PostPageView, DatabaseUnavailable>> {
    if (isErr(found)) return found;
    const { items, nextCursor }: Page<ChannelPostEntry> = this.deps.paginator.paginate(
      found.value,
      limit,
      { cursorOf, toItem: (entry) => entry }
    );
    return map(await toPostViews(this.deps, items, this.viewerOf(viewer)), (views) => ({
      items: views,
      nextCursor,
    }));
  }
}
