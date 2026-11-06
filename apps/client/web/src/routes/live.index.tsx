import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { liveNowQueryOptions } from '#app/features/live/api/live-queries';
import { LivePage } from '#app/features/live/components/live-page/live-page';

export const Route = createFileRoute('/live/')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureQueryData(liveNowQueryOptions(api)),
  head: () => ({ meta: [{ title: 'Live - Taitube' }] }),
  component: LivePage,
});
