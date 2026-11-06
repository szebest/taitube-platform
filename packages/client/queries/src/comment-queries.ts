import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from './api-provider';

export const creatorCommentKeys = {
  all: ['creator', 'comments'] as const,
};

const VIDEO_COMMENTS_KEY = ['comments'] as const;

interface CommentHeart {
  commentId: string;
  hearted: boolean;
}

function heartCommentMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: ({ commentId, hearted }: CommentHeart) => {
      const request = { params: { id: commentId } };
      return hearted ? api.comments.heartComment(request) : api.comments.unheartComment(request);
    },
    onSuccess: (_comment, _heart, _snapshot, { client }) =>
      Promise.all(
        [VIDEO_COMMENTS_KEY, creatorCommentKeys.all].map((queryKey) =>
          client.invalidateQueries({ queryKey })
        )
      ),
  });
}

/** The video owner's heart on a comment; every list that shows it, on the watch page and in the studio inbox, reloads. */
export function useHeartComment() {
  const api = useApi();
  return useMutation(heartCommentMutationOptions(api));
}
