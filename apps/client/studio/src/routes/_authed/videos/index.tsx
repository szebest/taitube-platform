import { createFileRoute } from '@tanstack/react-router';
import {
  LibraryPage,
  LibraryPageSkeleton,
  libraryQueryOptions,
  LibrarySearchSchema,
} from '#app/features/videos';

export const Route = createFileRoute('/_authed/videos/')({
  validateSearch: LibrarySearchSchema,
  loaderDeps: ({ search: { sort, page, q } }) => ({ sort, page, q }),
  loader: ({ context: { queryClient, api }, deps }) =>
    queryClient.ensureQueryData(libraryQueryOptions(api, deps)),
  pendingComponent: LibraryPageSkeleton,
  component: LibraryPage,
});
