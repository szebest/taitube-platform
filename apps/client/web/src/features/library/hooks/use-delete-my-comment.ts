import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

import { commentKeys } from '#app/features/watch/api/comment-queries';

import { myCommentsQueryOptions } from '../api/library-queries';
import { dropItems } from '../api/paged-list';
import { pagedMutationOptions } from './paged-mutation';
import { useListMutation } from './use-list-mutation';

function deleteMyCommentMutationOptions(api: ApiClient, commentId: string) {
  const key = myCommentsQueryOptions(api).queryKey;

  return pagedMutationOptions({
    key,
    request: () => api.comments.deleteComment({ params: { id: commentId } }),
    edit: (data) => dropItems(data, (comment) => comment.id === commentId),
    invalidate: [key, commentKeys.all],
  });
}

export function useDeleteMyComment(commentId: string) {
  const api = useApi();
  return useListMutation(deleteMyCommentMutationOptions(api, commentId));
}
