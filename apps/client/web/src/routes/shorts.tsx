import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { ShortsPlayerFrameSkeleton } from '#app/components/shorts/shorts-player-frame';
import { shortsFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { ShortsPage } from '#app/features/shorts/components/shorts-page';

export const Route = createFileRoute('/shorts')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    await queryClient.ensureInfiniteQueryData(shortsFeedQueryOptions(api));
  },
  head: () => ({ meta: [{ title: 'Shorts - Taitube' }] }),
  pendingComponent: ShortsPlayerFrameSkeleton,
  component: ShortsPage,
});
