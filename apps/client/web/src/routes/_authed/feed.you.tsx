import { createFileRoute } from '@tanstack/react-router';
import { myClipsQueryOptions } from '@vp/queries';
import { z } from 'zod';
import { ClipsShelf } from '#app/features/clips';
import {
  historyShelfQueryOptions,
  myPlaylistsQueryOptions,
  uploadsShelfQueryOptions,
  YouPage,
  YouPageSkeleton,
} from '#app/features/library';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';

function You() {
  return <YouPage clips={<ClipsShelf />} />;
}

export const Route = createFileRoute('/_authed/feed/you')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api, auth } }) => {
    const playlists = await queryClient.query({
      ...myPlaylistsQueryOptions(api),
      staleTime: 'static',
    });
    const watchLater = playlists.items.find(({ isSystem }) => isSystem);

    await Promise.all([
      queryClient.query({ ...historyShelfQueryOptions(api), staleTime: 'static' }),
      watchLater &&
        queryClient.query({ ...playlistQueryOptions(api, watchLater.id), staleTime: 'static' }),
      queryClient.infiniteQuery({ ...myClipsQueryOptions(api), staleTime: 'static' }),
      auth.status === 'signed-in' &&
        queryClient.query({
          ...uploadsShelfQueryOptions(api, auth.account.channel.id),
          staleTime: 'static',
        }),
    ]);
  },
  pendingComponent: YouPageSkeleton,
  component: You,
});
