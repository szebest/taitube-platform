import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { homeQueryOptions } from '#app/features/home/api/home-queries';
import { HomePage, HomePageSkeleton } from '#app/features/home/components/home-page/home-page';

export const Route = createFileRoute('/')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    await queryClient.ensureQueryData(homeQueryOptions(api));
  },
  pendingComponent: HomePageSkeleton,
  component: HomePage,
});
