import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import {
  historyShelfQueryOptions,
  myPlaylistsQueryOptions,
  uploadsShelfQueryOptions,
  watchLaterShelfQueryOptions,
} from '#app/features/library/api/library-queries';
import { YouPage, YouPageSkeleton } from '#app/features/library/components/you-page';

export const Route = createFileRoute('/_authed/feed/you')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api, auth } }) => {
    const playlists = await queryClient.ensureQueryData(myPlaylistsQueryOptions(api));
    const watchLater = playlists.items.find(({ isSystem }) => isSystem);

    await Promise.all([
      queryClient.ensureQueryData(historyShelfQueryOptions(api)),
      watchLater && queryClient.ensureQueryData(watchLaterShelfQueryOptions(api, watchLater.id)),
      auth.status === 'signed-in' &&
        queryClient.ensureQueryData(uploadsShelfQueryOptions(api, auth.account.channel.id)),
    ]);
  },
  pendingComponent: YouPageSkeleton,
  component: YouPage,
});
