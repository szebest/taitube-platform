import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { currentPickQueryOptions, homeQueryOptions } from '#app/features/home/api/home-queries';
import { HomePage, HomePageSkeleton } from '#app/features/home/components/home-page/home-page';

export const Route = createFileRoute('/')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    await Promise.all([
      queryClient.ensureQueryData(homeQueryOptions(api)),
      queryClient.prefetchQuery(currentPickQueryOptions(api)),
    ]);
  },
  pendingComponent: HomePageSkeleton,
  component: HomePage,
});
