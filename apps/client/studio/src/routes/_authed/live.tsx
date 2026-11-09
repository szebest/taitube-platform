import { createFileRoute } from '@tanstack/react-router';
import { prefetched } from '@vp/queries';
import { z } from 'zod';
import { LiveDashboard, LiveDashboardSkeleton, myLiveStreamQueryOptions } from '#app/features/live';

export const Route = createFileRoute('/_authed/live')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    prefetched(queryClient.query(myLiveStreamQueryOptions(api))),
  pendingComponent: LiveDashboardSkeleton,
  component: LiveDashboard,
});
