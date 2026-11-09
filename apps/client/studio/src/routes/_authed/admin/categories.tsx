import { createFileRoute } from '@tanstack/react-router';
import { prefetched } from '@vp/queries';
import { z } from 'zod';
import { adminCategoriesQueryOptions, CategoryTable } from '#app/features/admin';

export const Route = createFileRoute('/_authed/admin/categories')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    await prefetched(queryClient.query(adminCategoriesQueryOptions(api)));
  },
  component: CategoryTable,
});
