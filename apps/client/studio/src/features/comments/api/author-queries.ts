import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { creatorCommentKeys } from '@vp/queries';
const RECENT = 6;

/** The latest comments one author left on the channel's videos, whatever their state, newest first. */
export function authorCommentsQueryOptions(api: ApiClient, authorId: string) {
  return queryOptions({
    queryKey: creatorCommentKeys.byAuthor(authorId),
    queryFn: () =>
      api.creatorComments.listCreatorComments({
        query: { filter: 'all', authorId, limit: RECENT },
      }),
    select: ({ items }) => items,
  });
}
