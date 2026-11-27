import { type Result, assertNever, err, isErr, map, ok } from '@kit/result';
import type {
  ChannelPostRepositoryPort,
  ChannelRepositoryPort,
  CommentRepositoryPort,
  CommentViewer,
  VideoRepository,
} from '@vp/core/repositories';
import type { Comment, CommentHost, CommentTarget } from '@vp/domain';
import {
  type PublicHostReadFailure,
  commentTargetNotFound,
  decideCommentHostRead,
  publicHostReadFailure,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';

export interface CommentLookupDeps {
  comments: CommentRepositoryPort;
  videos: Pick<VideoRepository, 'findById'>;
  posts: Pick<ChannelPostRepositoryPort, 'findById'>;
  channels: Pick<ChannelRepositoryPort, 'findById'>;
}

type HostLookups = Omit<CommentLookupDeps, 'comments'>;

/** The target loaded as a host, or null once it is gone; no read rule applies yet. */
export async function findHost(
  deps: HostLookups,
  target: CommentTarget
): Promise<Result<CommentHost | null, DatabaseUnavailable>> {
  switch (target.type) {
    case 'video':
      return map(await deps.videos.findById(target.id), (video) =>
        video ? { type: 'video', video } : null
      );
    case 'post': {
      const post = await deps.posts.findById(target.id);
      if (isErr(post)) return post;
      if (!post.value) return ok(null);
      const channel = await deps.channels.findById(post.value.channelId);
      if (isErr(channel)) return channel;
      return ok(channel.value && { type: 'post', post: post.value, ownerId: channel.value.userId });
    }
    default:
      return assertNever(target, 'CommentTarget');
  }
}

/** A live comment with the host it sits under; either is null once it is gone. */
export async function commentWithHost(deps: CommentLookupDeps, commentId: string) {
  return withHost(deps, await deps.comments.findById(commentId));
}

/** The same lookup for a reader: a comment the viewer may not see is null, as if it were gone. */
export async function visibleCommentWithHost(
  deps: CommentLookupDeps,
  viewer: CommentViewer,
  commentId: string
) {
  return withHost(deps, await deps.comments.findVisible(viewer, commentId));
}

async function withHost(
  deps: CommentLookupDeps,
  comment: Result<Comment | null, DatabaseUnavailable>
): Promise<Result<{ comment: Comment | null; host: CommentHost | null }, DatabaseUnavailable>> {
  if (isErr(comment)) return comment;
  if (!comment.value) return ok({ comment: null, host: null });

  return map(await findHost(deps, comment.value.target), (host) => ({
    comment: comment.value,
    host,
  }));
}

/** The host whose comments the viewer reads, refused the way its own page refuses them. */
export async function readableHost(
  deps: HostLookups,
  viewer: UserContext | null,
  target: CommentTarget
): Promise<Result<CommentHost, DatabaseUnavailable | PublicHostReadFailure>> {
  const found = await findHost(deps, target);
  if (isErr(found)) return found;
  if (!found.value) return err(commentTargetNotFound(target));

  const decided = decideCommentHostRead(viewer, found.value);
  return isErr(decided) ? err(publicHostReadFailure(decided.error)) : decided;
}
