import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

import { commentKeys } from '../api/comment-queries';

function editCommentMutationOptions(api: ApiClient, commentId: string) {
  return mutationOptions({
    mutationFn: (content: string) =>
      api.comments.updateComment({ params: { id: commentId }, body: { content } }),
    onSuccess: (_comment, _content, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: commentKeys.all }),
  });
}

export function useEditComment(commentId: string) {
  const api = useApi();
  return useMutation(editCommentMutationOptions(api, commentId));
}
