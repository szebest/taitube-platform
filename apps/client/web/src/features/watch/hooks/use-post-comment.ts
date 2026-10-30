import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

import { commentKeys } from '../api/comment-queries';

export interface NewComment {
  content: string;
  parentId?: string;
}

function postCommentMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (comment: NewComment) =>
      api.comments.createComment({ params: { id: videoId }, body: comment }),
    onSettled: (_comment, _error, { parentId }, _snapshot, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: commentKeys.video(videoId) }),
        parentId && client.invalidateQueries({ queryKey: commentKeys.replies(parentId) }),
      ]),
  });
}

export function usePostComment(videoId: string) {
  const api = useApi();
  return useMutation(postCommentMutationOptions(api, videoId));
}
