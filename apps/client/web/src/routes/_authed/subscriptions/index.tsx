import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { SubscriptionsPage } from '#app/features/library';
import { mySubscriptionsQueryOptions } from '#app/lib/query-keys/subscription-keys';

export const Route = createFileRoute('/_authed/subscriptions/')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    queryClient.query({ ...mySubscriptionsQueryOptions(api), staleTime: 'static' }),
  component: SubscriptionsPage,
});
