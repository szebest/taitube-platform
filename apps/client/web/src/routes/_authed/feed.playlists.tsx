import { createFileRoute } from '@tanstack/react-router';
import {
  myPlaylistsQueryOptions,
  PlaylistsPage,
  PlaylistsPageSkeleton,
} from '#app/features/library';
import { urlModals } from '#app/lib/url-modal/registry';

export const Route = createFileRoute('/_authed/feed/playlists')({
  validateSearch: urlModals.searchSchema,
  search: { middlewares: [urlModals.retainUrlModal] },
  loader: ({ context: { queryClient, api } }) =>
    queryClient.query({ ...myPlaylistsQueryOptions(api), staleTime: 'static' }),
  pendingComponent: PlaylistsPageSkeleton,
  component: PlaylistsPage,
});
