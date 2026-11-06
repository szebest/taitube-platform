import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  currentPickQueryOptions,
  HomePage,
  HomePageSkeleton,
  homeQueryOptions,
} from '#app/features/browse';

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
