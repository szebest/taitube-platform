import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

import { commentKeys } from '../api/comment-queries';

function deleteCommentMutationOptions(api: ApiClient, commentId: string) {
  return mutationOptions({
    mutationFn: () => api.comments.deleteComment({ params: { id: commentId } }),
    onSuccess: (_result, _variables, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: commentKeys.all, refetchType: 'none' }),
  });
}

export function useDeleteComment(commentId: string) {
  const api = useApi();
  return useMutation(deleteCommentMutationOptions(api, commentId));
}
