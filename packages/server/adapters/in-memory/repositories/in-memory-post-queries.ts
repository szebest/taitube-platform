import type { ListChannelPostsOptions, ListManagedPostsOptions } from '@vp/core/repositories';
import {
  type ChannelPost,
  type ChannelPostEntry,
  type NewUnpublishedPostInput,
  isPostScheduled,
} from '@vp/domain';
import { POST_LIFECYCLE } from '@vp/domain-rules';
import { compareDesc, compareIdDesc, cursorOf } from './channel-post-ordering';

/** Newest created first with the id breaking ties, every status or one, after the cursor. */
export function managedPage(
  posts: readonly ChannelPost[],
  channelId: string,
  { status, cursor, limit }: ListManagedPostsOptions
): ChannelPost[] {
  const before = (post: ChannelPost) =>
    !cursor ||
    post.createdAt < cursor.createdAt ||
    (post.createdAt.getTime() === cursor.createdAt.getTime() && post.id < cursor.id);
  return posts
    .filter((post) => post.channelId === channelId && (!status || post.status === status))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || compareIdDesc(a.id, b.id))
    .filter(before)
    .slice(0, limit + 1)
    .map((post) => ({ ...post }));
}

export function dueScheduled(
  posts: readonly ChannelPost[],
  now: Date,
  limit: number
): ChannelPost[] {
  return posts
    .filter((post) => isPostScheduled(post.status) && post.publishAt && post.publishAt <= now)
    .sort((a, b) => (a.publishAt?.getTime() ?? 0) - (b.publishAt?.getTime() ?? 0))
    .slice(0, limit);
}

export function pinnedCount(posts: readonly ChannelPost[], channelId: string): number {
  return posts.filter((post) => post.channelId === channelId && post.pinnedAt !== null).length;
}

export function newUnpublishedPost(input: NewUnpublishedPostInput): ChannelPost {
  return {
    ...input,
    publishedAt: null,
    pinnedAt: null,
    editedAt: null,
    likeCount: 0,
    commentsCount: 0,
    version: 1,
    createdAt: new Date(),
  };
}

/** Published posts of the channels `belongs` picks, pinned first then newest, after the cursor. */
export function publishedPage(
  posts: ReadonlyMap<string, ChannelPost>,
  likes: ReadonlySet<string>,
  belongs: (post: ChannelPost) => boolean,
  { viewerId, cursor, limit }: ListChannelPostsOptions,
  ordered: (post: ChannelPost) => ChannelPost = (post) => post
): ChannelPostEntry[] {
  return [...posts.values()]
    .filter((post) => post.status === POST_LIFECYCLE.target('publish') && belongs(post))
    .map(ordered)
    .flatMap((post) => {
      const key = cursorOf(post);
      return key && (!cursor || compareDesc(key, cursor) > 0) ? [{ post, key }] : [];
    })
    .sort((a, b) => compareDesc(a.key, b.key))
    .slice(0, limit + 1)
    .map(({ post }) => ({
      post: { ...(posts.get(post.id) ?? post) },
      likedByViewer: viewerId !== null && likes.has(`${post.id}:${viewerId}`),
    }));
}
