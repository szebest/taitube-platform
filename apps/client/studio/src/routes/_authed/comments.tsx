import { createFileRoute } from '@tanstack/react-router';
import { prefetched } from '@vp/queries';
import { CommentsPage, inboxQueryOptions, InboxSearchSchema } from '#app/features/comments';

export const Route = createFileRoute('/_authed/comments')({
  validateSearch: InboxSearchSchema,
  loaderDeps: ({ search: { filter } }) => ({ filter }),
  loader: ({ context: { queryClient, api }, deps: { filter } }) =>
    prefetched(queryClient.infiniteQuery(inboxQueryOptions(api, filter))),
  component: CommentsPage,
});
