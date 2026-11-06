import { createFileRoute } from '@tanstack/react-router';

import { myPlaylistsQueryOptions } from '#app/features/library/api/library-queries';
import { PlaylistsPage } from '#app/features/library/components/playlists-page';
import { PlaylistsPageSkeleton } from '#app/features/library/components/playlists-page-skeleton';
import { urlModals } from '#app/features/url-modal/registry';

export const Route = createFileRoute('/_authed/feed/playlists')({
  validateSearch: urlModals.searchSchema,
  search: { middlewares: [urlModals.retainUrlModal] },
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureQueryData(myPlaylistsQueryOptions(api)),
  pendingComponent: PlaylistsPageSkeleton,
  component: PlaylistsPage,
});
