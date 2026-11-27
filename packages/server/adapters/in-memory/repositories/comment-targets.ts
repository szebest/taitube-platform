import { assertNever, unwrapOr } from '@kit/result';
import type { CommentTarget } from '@vp/domain';
import type { InMemoryChannelPostRepository } from './in-memory-channel-post-repository';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';
import type { InMemoryVideoRepository } from './in-memory-video-repository';

export interface CommentTargetStores {
  videosRepo: Pick<InMemoryVideoRepository, 'findById'>;
  postsRepo: Pick<InMemoryChannelPostRepository, 'posts'>;
  channelsRepo: Pick<InMemoryChannelRepository, 'findById'>;
}

/** The in-memory form of `LockedTarget`: what telling the target's owner needs. */
export type TargetOwner =
  | { type: 'video'; id: string; ownerId: string; title: string }
  | { type: 'post'; id: string; ownerId: string };

export function sameTarget(left: CommentTarget, right: CommentTarget): boolean {
  return left.type === right.type && left.id === right.id;
}

/** The target and who owns it, or null once it is gone, also when it went while the owner was read. */
export async function ownerOf(
  stores: CommentTargetStores,
  target: CommentTarget
): Promise<TargetOwner | null> {
  switch (target.type) {
    case 'video': {
      const video = unwrapOr(await stores.videosRepo.findById(target.id), null);
      return (
        video && { type: 'video', id: video.id, ownerId: video.ownerId, title: video.title ?? '' }
      );
    }
    case 'post': {
      const post = stores.postsRepo.posts.get(target.id);
      if (!post) return null;
      const channel = unwrapOr(await stores.channelsRepo.findById(post.channelId), null);
      if (!(channel && stores.postsRepo.posts.has(post.id))) return null;
      return { type: 'post', id: post.id, ownerId: channel.userId };
    }
    default:
      return assertNever(target, 'CommentTarget');
  }
}

/** The in-memory form of `moveCommentsCount`: the target's public count moves by `delta`. */
export async function moveCommentsCount(
  stores: CommentTargetStores,
  target: CommentTarget,
  delta: number
): Promise<void> {
  switch (target.type) {
    case 'video': {
      const video = unwrapOr(await stores.videosRepo.findById(target.id), null);
      if (video) video.commentsCount = (video.commentsCount ?? 0) + delta;
      return;
    }
    case 'post': {
      const post = stores.postsRepo.posts.get(target.id);
      if (post) post.commentsCount += delta;
      return;
    }
    default:
      return assertNever(target, 'CommentTarget');
  }
}

/** The in-memory form of `setCommentsCount`, for a recount. */
export async function setCommentsCount(
  stores: CommentTargetStores,
  target: CommentTarget,
  count: number
): Promise<void> {
  switch (target.type) {
    case 'video': {
      const video = unwrapOr(await stores.videosRepo.findById(target.id), null);
      if (video) video.commentsCount = count;
      return;
    }
    case 'post': {
      const post = stores.postsRepo.posts.get(target.id);
      if (post) post.commentsCount = count;
      return;
    }
    default:
      return assertNever(target, 'CommentTarget');
  }
}

/** The in-memory form of the trigger that deletes a target's comments with it. */
export function removeTargetComments(
  comments: Map<string, { target: CommentTarget }>,
  target: CommentTarget
): void {
  for (const [id, comment] of comments) {
    if (sameTarget(comment.target, target)) comments.delete(id);
  }
}
