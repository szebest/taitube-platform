import { createFileRoute } from '@tanstack/react-router';
import { inboxQueryOptions } from '#app/features/comments/api/inbox-queries';
import { InboxSearchSchema } from '#app/features/comments/api/inbox-search';
import { CommentsPage } from '#app/features/comments/components/comments-page/comments-page';

export const Route = createFileRoute('/_authed/comments')({
  validateSearch: InboxSearchSchema,
  loaderDeps: ({ search: { filter } }) => ({ filter }),
  loader: ({ context: { queryClient, api }, deps: { filter } }) =>
    queryClient.prefetchInfiniteQuery(inboxQueryOptions(api, filter)),
  component: CommentsPage,
});
