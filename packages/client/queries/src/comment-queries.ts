import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from './api-provider';

export const creatorCommentKeys = {
  all: ['creator', 'comments'] as const,
};

const VIDEO_COMMENTS_KEY = ['comments'] as const;

export const commentListKeys = [VIDEO_COMMENTS_KEY, creatorCommentKeys.all] as const;

interface CommentHeart {
  commentId: string;
  hearted: boolean;
}

interface CommentPin {
  commentId: string;
  pinned: boolean;
}

function heartCommentMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: ({ commentId, hearted }: CommentHeart) => {
      const request = { params: { id: commentId } };
      return hearted ? api.comments.heartComment(request) : api.comments.unheartComment(request);
    },
    onSuccess: (_comment, _heart, _snapshot, { client }) =>
      Promise.all(commentListKeys.map((queryKey) => client.invalidateQueries({ queryKey }))),
  });
}

function pinCommentMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: ({ commentId, pinned }: CommentPin) => {
      const request = { params: { id: commentId } };
      return pinned ? api.comments.pinComment(request) : api.comments.unpinComment(request);
    },
    onSuccess: (_comment, _pin, _snapshot, { client }) =>
      Promise.all(commentListKeys.map((queryKey) => client.invalidateQueries({ queryKey }))),
  });
}

/** The video owner's heart on a comment; every list that shows it, on the watch page and in the studio inbox, reloads. */
export function useHeartComment() {
  const api = useApi();
  return useMutation(heartCommentMutationOptions(api));
}

/** Pins a top-level comment to the top of its video's list, or takes the pin off. */
export function usePinComment() {
  const api = useApi();
  return useMutation(pinCommentMutationOptions(api));
}
