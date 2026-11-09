import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { liveNowQueryOptions, LivePage } from '#app/features/live';

export const Route = createFileRoute('/live/')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    queryClient.query({ ...liveNowQueryOptions(api), staleTime: 'static' }),
  head: () => ({ meta: [{ title: 'Live - Taitube' }] }),
  component: LivePage,
});
