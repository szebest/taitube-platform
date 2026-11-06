import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { adminPicksQueryOptions, CurationPage } from '#app/features/admin';

export const Route = createFileRoute('/_authed/admin/curation')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    await queryClient.prefetchQuery(adminPicksQueryOptions(api));
  },
  component: CurationPage,
});
