import { infiniteQueryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { CommentSort } from '@vp/domain';
import { KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';

export const commentKeys = {
  all: ['comments'] as const,
  video: (videoId: string) => [...commentKeys.all, 'video', videoId] as const,
  list: (videoId: string, sort: CommentSort) => [...commentKeys.video(videoId), sort] as const,
  replies: (commentId: string) => [...commentKeys.all, 'replies', commentId] as const,
};

export function commentsQueryOptions(api: ApiClient, videoId: string, sort: CommentSort) {
  return infiniteQueryOptions({
    queryKey: commentKeys.list(videoId, sort),
    queryFn: ({ pageParam }) =>
      api.comments.listVideoComments({
        params: { id: videoId },
        query: { sort, limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}

export function repliesQueryOptions(api: ApiClient, commentId: string) {
  return infiniteQueryOptions({
    queryKey: commentKeys.replies(commentId),
    queryFn: ({ pageParam }) =>
      api.comments.listCommentReplies({
        params: { id: commentId },
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}
