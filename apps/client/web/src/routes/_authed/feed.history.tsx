import { createFileRoute } from '@tanstack/react-router';
import { assertNever } from '@vp/result';
import {
  LibraryPage,
  LibraryPageSkeleton,
  LibrarySearchSchema,
  likedVideosQueryOptions,
  myCommentsQueryOptions,
  searchHistoryQueryOptions,
  watchHistoryQueryOptions,
} from '#app/features/library';
import { urlModals } from '#app/lib/url-modal/registry';

export const Route = createFileRoute('/_authed/feed/history')({
  validateSearch: (search) => LibrarySearchSchema.and(urlModals.searchSchema).parse(search),
  search: { middlewares: [urlModals.retainUrlModal] },
  loaderDeps: ({ search: { tab = 'history' } }) => ({ tab }),
  loader: async ({ context: { queryClient, api }, deps: { tab } }) => {
    switch (tab) {
      case 'history':
        await queryClient.ensureInfiniteQueryData(watchHistoryQueryOptions(api));
        return;
      case 'searches':
        await queryClient.ensureInfiniteQueryData(searchHistoryQueryOptions(api));
        return;
      case 'liked':
        await queryClient.ensureInfiniteQueryData(likedVideosQueryOptions(api));
        return;
      case 'comments':
        await queryClient.ensureInfiniteQueryData(myCommentsQueryOptions(api));
        return;
      default:
        assertNever(tab, 'library tab');
    }
  },
  pendingComponent: LibraryPageSkeleton,
  component: LibraryPage,
});
