import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { adminPicksQueryOptions } from '#app/features/admin/api/admin-picks';
import { CurationPage } from '#app/features/admin/components/curation-page';

export const Route = createFileRoute('/_authed/admin/curation')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    await queryClient.prefetchQuery(adminPicksQueryOptions(api));
  },
  component: CurationPage,
});
