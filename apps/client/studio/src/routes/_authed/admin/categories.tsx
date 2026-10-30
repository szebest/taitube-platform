import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { adminCategoriesQueryOptions } from '#app/features/admin/api/admin-categories';
import { CategoryTable } from '#app/features/admin/components/category-table';

export const Route = createFileRoute('/_authed/admin/categories')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    await queryClient.prefetchQuery(adminCategoriesQueryOptions(api));
  },
  component: CategoryTable,
});
