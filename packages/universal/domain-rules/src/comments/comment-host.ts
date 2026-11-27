import { type Result, assertNever, map } from '@kit/result';
import type { CommentHost, CommentTarget } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type PostNotFound, decidePostRead, postNotFound } from '../posts/index';
import { type ThreadNotFound, decideThreadRead, threadNotFound } from '../threads/index';
import {
  type ReadVideoFailure,
  type VideoForbidden,
  type VideoNotFound,
  type VideoReadRequiresAuth,
  decideVideoRead,
  publicReadFailure,
  videoNotFound,
} from '../videos/index';

export function commentHostTarget(host: CommentHost): CommentTarget {
  switch (host.type) {
    case 'video':
      return { type: 'video', id: host.video.id };
    case 'post':
      return { type: 'post', id: host.post.id };
    case 'thread':
      return { type: 'thread', id: host.thread.id };
    default:
      return assertNever(host, 'CommentHost');
  }
}

export interface CommentHostTraits {
  /** The channel that moderates the host's comments. */
  channelId: string;
  /** Who owns that channel: the creator a comment's badge and heart belong to. */
  ownerId: string;
  commentsEnabled: boolean;
  commentsCount: number;
}

export function commentHostTraits(host: CommentHost): CommentHostTraits {
  switch (host.type) {
    case 'video': {
      const { channelId, ownerId, commentsEnabled, commentsCount } = host.video;
      return {
        channelId,
        ownerId,
        commentsEnabled: commentsEnabled ?? true,
        commentsCount: commentsCount ?? 0,
      };
    }
    case 'post': {
      const { channelId, commentsEnabled, commentsCount } = host.post;
      return { channelId, ownerId: host.ownerId, commentsEnabled, commentsCount };
    }
    case 'thread': {
      const { channelId, ownerId, commentsEnabled } = host.video;
      return {
        channelId,
        ownerId,
        commentsEnabled: commentsEnabled ?? true,
        commentsCount: host.thread.commentsCount,
      };
    }
    default:
      return assertNever(host, 'CommentHost');
  }
}

export type ReadCommentHostFailure = ReadVideoFailure | PostNotFound | ThreadNotFound;

/** Who may read the comments of a host: the video's read rules, or anyone for a published post. */
export function decideCommentHostRead(
  viewer: UserContext | null,
  host: CommentHost
): Result<CommentHost, ReadCommentHostFailure> {
  switch (host.type) {
    case 'video':
      return map(
        decideVideoRead({ viewer, video: host.video, videoId: host.video.id }),
        () => host
      );
    case 'post':
      return map(decidePostRead({ post: host.post, postId: host.post.id }), () => host);
    case 'thread':
      return map(
        decideThreadRead({
          viewer,
          thread: host.thread,
          threadId: host.thread.id,
          video: host.video,
          authorShadowed: host.authorShadowed,
        }),
        () => host
      );
    default:
      return assertNever(host, 'CommentHost');
  }
}

export type PublicHostReadFailure =
  | VideoNotFound
  | VideoReadRequiresAuth
  | VideoForbidden
  | PostNotFound
  | ThreadNotFound;

/** `publicReadFailure` for any host: a post's refusal is already the disguise. */
export function publicHostReadFailure(failure: ReadCommentHostFailure): PublicHostReadFailure {
  return failure.code === ErrorCodes.POST_NOT_FOUND || failure.code === ErrorCodes.THREAD_NOT_FOUND
    ? failure
    : publicReadFailure(failure);
}

/** The creator and the channel of a host, under the names the comment permissions take. */
export function commentOwnership(host: CommentHost): {
  videoOwnerId: string;
  videoChannelId: string;
} {
  const { ownerId, channelId } = commentHostTraits(host);
  return { videoOwnerId: ownerId, videoChannelId: channelId };
}

/** A target that is not there, refused the way a reader of that kind is refused. */
export function commentTargetNotFound(
  target: CommentTarget
): VideoNotFound | PostNotFound | ThreadNotFound {
  switch (target.type) {
    case 'video':
      return videoNotFound(target.id);
    case 'post':
      return postNotFound(target.id);
    case 'thread':
      return threadNotFound(target.id);
    default:
      return assertNever(target, 'CommentTarget');
  }
}
