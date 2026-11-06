import { createFileRoute } from '@tanstack/react-router';
import { libraryQueryOptions } from '#app/features/content/api/library-queries';
import { LibrarySearchSchema } from '#app/features/content/api/library-search';
import { LibraryPage, LibraryPageSkeleton } from '#app/features/content/components/library-page';

export const Route = createFileRoute('/_authed/videos/')({
  validateSearch: LibrarySearchSchema,
  loaderDeps: ({ search: { sort, page, q } }) => ({ sort, page, q }),
  loader: ({ context: { queryClient, api }, deps }) =>
    queryClient.ensureQueryData(libraryQueryOptions(api, deps)),
  pendingComponent: LibraryPageSkeleton,
  component: LibraryPage,
});
