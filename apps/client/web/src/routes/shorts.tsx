import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ShortsPlayerFrameSkeleton } from '#app/components/shorts/shorts-player-frame';
import { shortsFeedQueryOptions } from '#app/features/browse';
import { ShortsPage } from '#app/features/shorts';

export const Route = createFileRoute('/shorts')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    await queryClient.ensureInfiniteQueryData(shortsFeedQueryOptions(api));
  },
  head: () => ({ meta: [{ title: 'Shorts - Taitube' }] }),
  pendingComponent: ShortsPlayerFrameSkeleton,
  component: ShortsPage,
});
