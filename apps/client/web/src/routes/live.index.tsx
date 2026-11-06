import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { liveNowQueryOptions, LivePage } from '#app/features/live';

export const Route = createFileRoute('/live/')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureQueryData(liveNowQueryOptions(api)),
  head: () => ({ meta: [{ title: 'Live - Taitube' }] }),
  component: LivePage,
});
