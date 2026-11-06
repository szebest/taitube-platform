import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { creatorCommentKeys, useApi } from '@vp/queries';

export interface CommentPin {
  commentId: string;
  pinned: boolean;
}

function pinCommentMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: ({ commentId, pinned }: CommentPin) => {
      const request = { params: { id: commentId } };
      return pinned ? api.comments.pinComment(request) : api.comments.unpinComment(request);
    },
    onSuccess: (_comment, _pin, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: creatorCommentKeys.all }),
  });
}

/** Pins a top-level comment to the top of its video's list, or takes the pin off. */
export function usePinComment() {
  const api = useApi();
  return useMutation(pinCommentMutationOptions(api));
}
