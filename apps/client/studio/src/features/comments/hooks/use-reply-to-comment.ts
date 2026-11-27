import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { threadRootId } from '@vp/domain';
import { creatorCommentKeys, useApi } from '@vp/queries';
import type { InboxComment } from '../api/inbox-queries';

function replyMutationOptions(api: ApiClient, comment: InboxComment) {
  return mutationOptions({
    mutationFn: (content: string) => {
      const request = {
        params: { id: comment.target.id },
        body: { content, parentId: threadRootId(comment) },
      };
      return comment.target.type === 'post'
        ? api.posts.createPostComment(request)
        : api.comments.createComment(request);
    },
    onSuccess: (_reply, _content, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: creatorCommentKeys.all }),
  });
}

/** The creator's reply, posted in the comment's thread on the video or post it sits under. */
export function useReplyToComment(comment: InboxComment) {
  const api = useApi();
  return useMutation(replyMutationOptions(api, comment));
}
