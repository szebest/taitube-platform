import { createFileRoute } from '@tanstack/react-router';
import { prefetched } from '@vp/queries';
import { z } from 'zod';
import { AdminPageSkeleton, adminPicksQueryOptions, CurationPage } from '#app/features/admin';

export const Route = createFileRoute('/_authed/admin/curation')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    await prefetched(queryClient.query(adminPicksQueryOptions(api)));
  },
  pendingComponent: AdminPageSkeleton,
  component: CurationPage,
});
