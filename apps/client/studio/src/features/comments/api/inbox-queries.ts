import { KEYSET_PAGE_SIZE, keysetPaging } from '@kit/query';
import { infiniteQueryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { CreatorInboxCommentView } from '@vp/api-contracts';
import type { CreatorInboxFilter } from '@vp/domain';
import { creatorCommentKeys } from '@vp/queries';

export type InboxComment = CreatorInboxCommentView;

/** The comments on the creator's videos under one filter, newest first, keyset-paged. */
export function inboxQueryOptions(api: ApiClient, filter: CreatorInboxFilter) {
  return infiniteQueryOptions({
    queryKey: creatorCommentKeys.list(filter),
    queryFn: ({ pageParam }) =>
      api.creatorComments.listCreatorComments({
        query: { filter, limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}
