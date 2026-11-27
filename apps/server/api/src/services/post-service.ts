import type { CursorPayload, InvalidCursor, Page, Paginator } from '@kit/pagination';
import { MS_PER_DAY } from '@kit/primitives';
import { type Result, assertNever, err, ignore, isErr, map, ok } from '@kit/result';
import type { PostLikeView, PostPageView, PostView, PostWriteBody } from '@vp/api-contracts';
import type { CommentCachePort } from '@vp/core/ports';
import type { ChannelPostRepositoryPort, ChannelRepositoryPort } from '@vp/core/repositories';
import type {
  ActingChannel,
  ChannelPost,
  ChannelPostEntry,
  NewChannelAuditEntry,
  PostPayload,
} from '@vp/domain';
import {
  type AuthorizationFailure,
  type ChannelNotFound,
  type CreatePostFailure,
  type EditPostFailure,
  type PostNotFound,
  decideChannelTask,
  decidePostCreate,
  decidePostEdit,
  decidePostReact,
  decidePostRead,
  decidePostTarget,
  decidePostWrite,
  postNotFound,
} from '@vp/domain-rules';
import { type DatabaseUnavailable, type VersionConflict, versionConflict } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { auditActor } from './audit-actor';
import { findChannelByIdOrHandle } from './channel-lookup';
import {
  channelPostCursorPayload,
  decodeChannelPostCursor,
  decodeFeedPostCursor,
  feedPostCursorPayload,
} from './post-cursor';
import { loadSharedTarget } from './post-share-cards';
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

export type EditPostBody = Omit<PostWriteBody, 'commentsEnabled'> & {
  commentsEnabled?: boolean;
  version: number;
};

type PostAuditAction = Extract<NewChannelAuditEntry, { targetType: 'post' }>['action'];
type ReadFailure = PostNotFound | DatabaseUnavailable;

function auditOf(
  action: PostAuditAction,
  user: UserContext,
  channelId: string,
  post: { id: string; payload: PostPayload }
): NewChannelAuditEntry {
  return {
    channelId,
    ...auditActor(user),
    action,
    targetType: 'post',
    targetId: post.id,
    meta: { kind: post.payload.kind },
  };
}

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
    return this.page(found, limit, channelPostCursorPayload);
  }

  async get(viewer: UserContext | null, postId: string): Promise<Result<PostView, ReadFailure>> {
    const post = await this.readable(postId);
    if (isErr(post)) return post;
    const liked = viewer ? await this.deps.posts.isLiked(postId, viewer.id) : ok(false);
    if (isErr(liked)) return liked;
    return this.viewOf({ post: post.value, likedByViewer: liked.value });
  }

  async create(
    user: UserContext,
    acting: ActingChannel,
    body: PostWriteBody
  ): Promise<Result<PostView, CreatePostFailure | PostNotFound | DatabaseUnavailable>> {
    const { posts, now } = this.deps;
    const channel = { id: acting.channelId, ownerId: acting.ownerId };
    const today = Math.floor(now() / MS_PER_DAY) * MS_PER_DAY;
    const created = await posts.countCreatedSince(channel.id, new Date(today));
    if (isErr(created)) return created;
    const shared = await loadSharedTarget(this.deps, body.payload);
    if (isErr(shared)) return shared;

    const decided = decidePostCreate({
      actor: user,
      channel,
      payload: body.payload,
      shared: shared.value,
      createdToday: created.value,
    });
    if (isErr(decided)) return decided;

    const input = {
      id: uuidv7(),
      channelId: channel.id,
      authorUserId: user.id,
      payload: decided.value.payload,
      commentsEnabled: body.commentsEnabled,
    };
    const published = await posts.publish(
      input,
      auditOf('post.published', user, channel.id, input)
    );
    if (isErr(published)) return published;
    return this.viewOf({ post: published.value, likedByViewer: false });
  }

  async edit(
    user: UserContext,
    acting: ActingChannel,
    postId: string,
    body: EditPostBody
  ): Promise<Result<PostView, EditPostFailure | VersionConflict | DatabaseUnavailable>> {
    const { posts } = this.deps;
    const channel = { id: acting.channelId, ownerId: acting.ownerId };
    const found = await posts.findById(postId);
    if (isErr(found)) return found;
    const shared = await loadSharedTarget(this.deps, body.payload);
    if (isErr(shared)) return shared;

    const decided = decidePostEdit({
      actor: user,
      channel,
      post: found.value,
      postId,
      payload: body.payload,
      shared: shared.value,
    });
    if (isErr(decided)) return decided;
    if (!found.value) return err(postNotFound(postId));

    const { payload } = decided.value;
    const written = await posts.edit(
      postId,
      body.version,
      { payload, commentsEnabled: body.commentsEnabled ?? found.value.commentsEnabled },
      auditOf('post.updated', user, channel.id, { id: postId, payload })
    );
    if (isErr(written)) return written;
    const outcome = written.value;
    switch (outcome.type) {
      case 'missing':
        return err(postNotFound(postId));
      case 'stale':
        return err(versionConflict(postId, body.version));
      case 'edited': {
        const liked = await posts.isLiked(postId, user.id);
        if (isErr(liked)) return liked;
        return this.viewOf({ post: outcome.post, likedByViewer: liked.value });
      }
      default:
        return assertNever(outcome, 'ChannelPostEdited');
    }
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
      auditOf('post.deleted', user, channel.id, target.value)
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
    return this.page(found, limit, feedPostCursorPayload);
  }

  private async readable(postId: string): Promise<Result<ChannelPost, ReadFailure>> {
    const found = await this.deps.posts.findById(postId);
    if (isErr(found)) return found;
    return decidePostRead({ post: found.value, postId });
  }

  private async viewOf(entry: ChannelPostEntry): Promise<Result<PostView, ReadFailure>> {
    const views = await toPostViews(this.deps, [entry]);
    if (isErr(views)) return views;
    const [view] = views.value;
    return view ? ok(view) : err(postNotFound(entry.post.id));
  }

  private async page(
    found: Result<ChannelPostEntry[], DatabaseUnavailable>,
    limit: number,
    cursorOf: (entry: ChannelPostEntry) => CursorPayload
  ): Promise<Result<PostPageView, DatabaseUnavailable>> {
    if (isErr(found)) return found;
    const { items, nextCursor }: Page<ChannelPostEntry> = this.deps.paginator.paginate(
      found.value,
      limit,
      { cursorOf, toItem: (entry) => entry }
    );
    return map(await toPostViews(this.deps, items), (views) => ({ items: views, nextCursor }));
  }
}
