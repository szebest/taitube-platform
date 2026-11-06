import { infiniteQueryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { CreatorInboxCommentView } from '@vp/api-contracts';
import type { CreatorInboxFilter } from '@vp/domain';
import { creatorCommentKeys, KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';

export type InboxComment = CreatorInboxCommentView;

/** The comments on the creator's videos under one filter, newest first, keyset-paged. */
export function inboxQueryOptions(api: ApiClient, filter: CreatorInboxFilter) {
  return infiniteQueryOptions({
    queryKey: [...creatorCommentKeys.all, filter],
    queryFn: ({ pageParam }) =>
      api.creatorComments.listCreatorComments({
        query: { filter, limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}
