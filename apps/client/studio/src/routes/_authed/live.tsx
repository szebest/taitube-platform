import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { myLiveStreamQueryOptions } from '#app/features/live/api/live-queries';
import { LiveDashboard } from '#app/features/live/components/live-dashboard';
import { LiveDashboardSkeleton } from '#app/features/live/components/live-dashboard-skeleton';

export const Route = createFileRoute('/_authed/live')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    queryClient.prefetchQuery(myLiveStreamQueryOptions(api)),
  pendingComponent: LiveDashboardSkeleton,
  component: LiveDashboard,
});
