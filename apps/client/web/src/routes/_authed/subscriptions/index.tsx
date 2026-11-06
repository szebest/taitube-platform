import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { mySubscriptionsQueryOptions, SubscriptionsPage } from '#app/features/library';

export const Route = createFileRoute('/_authed/subscriptions/')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureQueryData(mySubscriptionsQueryOptions(api)),
  component: SubscriptionsPage,
});
