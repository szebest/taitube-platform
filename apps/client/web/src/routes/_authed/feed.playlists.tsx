import { createFileRoute } from '@tanstack/react-router';
import { myPlaylistsQueryOptions } from '#app/features/library/api/library-queries';
import { PlaylistsPageSkeleton } from '#app/features/library/components/playlists-page-skeleton/playlists-page-skeleton';
import { PlaylistsPage } from '#app/features/library/components/playlists-page/playlists-page';
import { urlModals } from '#app/lib/url-modal/registry';

export const Route = createFileRoute('/_authed/feed/playlists')({
  validateSearch: urlModals.searchSchema,
  search: { middlewares: [urlModals.retainUrlModal] },
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureQueryData(myPlaylistsQueryOptions(api)),
  pendingComponent: PlaylistsPageSkeleton,
  component: PlaylistsPage,
});
