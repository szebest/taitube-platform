import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { categoriesQueryOptions } from '#app/features/categories/api/category-queries';
import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { AllVideosPage } from '#app/modules/AllVideosPage';

export const Route = createFileRoute('/')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureInfiniteQueryData(publicFeedQueryOptions({ sort: 'recent' })),
      queryClient.ensureQueryData(categoriesQueryOptions()),
    ]);
  },
  component: AllVideosPage,
});
