import { infiniteQueryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { CommentReportQueueItemView } from '@vp/api-contracts';
import { KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';

export type AdminReport = CommentReportQueueItemView;

export const adminReportKeys = {
  all: ['admin', 'reports'] as const,
};

/** The comment report queue, open reports first, keyset-paged. */
export function adminReportsQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: adminReportKeys.all,
    queryFn: ({ pageParam }) =>
      api.commentReports.listCommentReports({
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}
