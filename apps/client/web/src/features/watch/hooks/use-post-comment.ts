import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { fromPromise } from '@vp/result';
import { useApi } from '@vp/queries';

import { isQueuedByWorker } from '#app/features/offline/is-queued-by-worker';
import { commentKeys } from '../api/comment-queries';

export interface NewComment {
  content: string;
  parentId?: string;
}

function postCommentMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: async (comment: NewComment) => {
      const posted = await fromPromise(
        api.comments.createComment({ params: { id: videoId }, body: comment }),
        (cause) => cause
      );
      if (posted.ok) {
        return posted.value;
      }
      if (isQueuedByWorker(posted.error)) {
        return null;
      }
      throw posted.error;
    },
    onSettled: (comment, _error, { parentId }, _snapshot, { client }) =>
      comment !== null &&
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
