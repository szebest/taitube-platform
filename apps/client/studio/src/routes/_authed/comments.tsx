import { createFileRoute } from '@tanstack/react-router';
import { CommentsPage, inboxQueryOptions, InboxSearchSchema } from '#app/features/comments';

export const Route = createFileRoute('/_authed/comments')({
  validateSearch: InboxSearchSchema,
  loaderDeps: ({ search: { filter } }) => ({ filter }),
  loader: ({ context: { queryClient, api }, deps: { filter } }) =>
    queryClient.prefetchInfiniteQuery(inboxQueryOptions(api, filter)),
  component: CommentsPage,
});
