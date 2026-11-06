import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { LiveDashboard, LiveDashboardSkeleton, myLiveStreamQueryOptions } from '#app/features/live';

export const Route = createFileRoute('/_authed/live')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    queryClient.prefetchQuery(myLiveStreamQueryOptions(api)),
  pendingComponent: LiveDashboardSkeleton,
  component: LiveDashboard,
});
