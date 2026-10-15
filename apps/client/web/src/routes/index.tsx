import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { categoriesQueryOptions } from '#app/features/categories/api/category-queries';
import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { AllVideosPage } from '#app/modules/AllVideosPage';

export const Route = createFileRoute('/')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    await Promise.all([
      queryClient.ensureInfiniteQueryData(publicFeedQueryOptions(api, { sort: 'recent' })),
      queryClient.ensureQueryData(categoriesQueryOptions(api)),
    ]);
  },
  component: AllVideosPage,
});
