import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { mySubscriptionsQueryOptions } from '#app/features/library/api/subscription-queries';
import { SubscriptionsPage } from '#app/features/library/components/subscriptions-page/subscriptions-page';

export const Route = createFileRoute('/_authed/subscriptions/')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureQueryData(mySubscriptionsQueryOptions(api)),
  component: SubscriptionsPage,
});
