import { KEYSET_PAGE_SIZE, keysetPaging } from '@kit/query';
import { fromPromise, ignore } from '@kit/result';
import {
  type InfiniteData,
  infiniteQueryOptions,
  mutationOptions,
  type QueryClient,
  queryOptions,
  useMutation,
} from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { Account, PostLikeView, PostPageView, PostView } from '@vp/api-contracts';
import type { CommentSort } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { useApi } from './api-provider';
import { failureCode } from './failure-code';
import { useAccount, useActingChannelId } from './session-provider';

const GUEST_KEY = 'guest';

export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  channel: (channelId: string, viewerId: string | null) =>
    [...postKeys.lists(), 'channel', channelId, viewerId ?? GUEST_KEY] as const,
  community: (viewerId: string | null) =>
    [...postKeys.lists(), 'community', viewerId ?? GUEST_KEY] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (postId: string, viewerId: string | null) =>
    [...postKeys.details(), postId, viewerId ?? GUEST_KEY] as const,
  comments: (postId: string, sort: CommentSort) =>
    [...postKeys.all, 'comments', postId, sort] as const,
};

/** Who a post read is for: the account and the channel it acts as, `null` for a guest, so a switch never shows another identity's likes and votes. */
export function postViewerKey(
  account: Pick<Account, 'id'> | undefined,
  actingChannelId: string | undefined
): string | null {
  return account ? `${account.id}:${actingChannelId ?? 'primary'}` : null;
}

export function usePostViewer(): string | null {
  return postViewerKey(useAccount(), useActingChannelId());
}

type PostPages = InfiniteData<PostPageView, string | undefined>;

/** A channel's published posts, pinned first; the viewer is in the key because the like and the vote on each post are theirs. */
export function channelPostsQueryOptions(
  api: ApiClient,
  channelId: string,
  viewerId: string | null
) {
  return infiniteQueryOptions({
    queryKey: postKeys.channel(channelId, viewerId),
    queryFn: ({ pageParam }) =>
      api.posts.listChannelPosts({
        params: { idOrHandle: channelId },
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}

/** The posts of the channels the viewer subscribes to, newest first. */
export function communityFeedQueryOptions(api: ApiClient, viewerId: string | null) {
  return infiniteQueryOptions({
    queryKey: postKeys.community(viewerId),
    queryFn: ({ pageParam }) =>
      api.posts.getCommunityFeed({ query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam } }),
    ...keysetPaging,
  });
}

export function postQueryOptions(api: ApiClient, postId: string, viewerId: string | null) {
  return queryOptions({
    queryKey: postKeys.detail(postId, viewerId),
    queryFn: () => api.posts.getPost({ params: { id: postId } }),
  });
}

/** The root comments under a post, which share the video comment contract. */
export function postCommentsQueryOptions(api: ApiClient, postId: string, sort: CommentSort) {
  return infiniteQueryOptions({
    queryKey: postKeys.comments(postId, sort),
    queryFn: ({ pageParam }) =>
      api.posts.listPostComments({
        params: { id: postId },
        query: { sort, limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}

function writePost(client: QueryClient, postId: string, change: (post: PostView) => PostView) {
  const swap = (post: PostView) => (post.id === postId ? change(post) : post);

  client.setQueriesData<PostPages>(
    { queryKey: postKeys.lists() },
    (held) =>
      held && {
        ...held,
        pages: held.pages.map((page) => ({ ...page, items: page.items.map(swap) })),
      }
  );
  client.setQueriesData<PostView>({ queryKey: postKeys.details() }, (held) => held && swap(held));
}

interface PostLike {
  postId: string;
  liked: boolean;
}

function likeToPost(like: PostLikeView) {
  return (post: PostView): PostView => ({
    ...post,
    likedByViewer: like.liked,
    likeCount: like.likeCount,
  });
}

function setPostLikeMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: ({ postId, liked }: PostLike) => {
      const request = { params: { id: postId } };
      return liked ? api.posts.likePost(request) : api.posts.unlikePost(request);
    },
    onSuccess: (like, _variables, _snapshot, { client }) =>
      writePost(client, like.postId, likeToPost(like)),
  });
}

interface PostVote {
  postId: string;
  optionIndex: number;
}

const SETTLED_POLL = new Set<string>([ErrorCodes.POST_ALREADY_VOTED, ErrorCodes.POST_POLL_CLOSED]);

function votePostMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: ({ postId, optionIndex }: PostVote) =>
      api.postStudio.votePost({ params: { id: postId }, body: { optionIndex } }),
    onSuccess: (voted, _variables, _snapshot, { client }) =>
      writePost(client, voted.id, () => voted),
    onError: (error, _variables, _snapshot, { client }) =>
      SETTLED_POLL.has(failureCode(error)) && client.invalidateQueries({ queryKey: postKeys.all }),
  });
}

/** Like or unlike a post; every list and page that shows it takes the server's count. */
export function useSetPostLike() {
  const api = useApi();
  return useMutation(setPostLikeMutationOptions(api));
}

/** One final vote or answer. A second vote or a closed poll refetches, so the card turns to its results. */
export function useVotePost() {
  const api = useApi();
  return useMutation(votePostMutationOptions(api));
}

/** The open beacon of a post page, counted once per viewer and day by the API. */
export async function recordPostOpen(api: ApiClient, postId: string): Promise<void> {
  ignore(
    await fromPromise(
      api.postStudio.recordPostOpen({ params: { id: postId }, keepalive: true }),
      () => null
    ),
    'a missed beacon only leaves one view uncounted'
  );
}

/** The beacon of a click on a post's share card. */
export async function recordPostShareClick(api: ApiClient, postId: string): Promise<void> {
  ignore(
    await fromPromise(
      api.postStudio.recordPostShareClick({ params: { id: postId }, keepalive: true }),
      () => null
    ),
    'a missed beacon only leaves one click uncounted'
  );
}

interface PostReply {
  content: string;
  parentId?: string;
}

function replyToPostMutationOptions(api: ApiClient, postId: string) {
  return mutationOptions({
    mutationFn: (reply: PostReply) =>
      api.posts.createPostComment({ params: { id: postId }, body: reply }),
    onSettled: (_comment, _error, _reply, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: postKeys.all }),
  });
}

/** A root comment under a post, or a reply to one; the post's count and the list reload. */
export function useReplyToPost(postId: string) {
  const api = useApi();
  return useMutation(replyToPostMutationOptions(api, postId));
}
