import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { readAuthToken } from '#app/auth-token';
import { mySubscriptionsQueryOptions } from '#app/features/subscriptions/api/subscription-queries';
import { SubscriptionsPage } from '#app/modules/Subscriptions';

export const Route = createFileRoute('/_authed/subscriptions/')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient } }) => {
    if (readAuthToken() === null) return;
    await queryClient.ensureQueryData(mySubscriptionsQueryOptions());
  },
  component: SubscriptionsPage,
});
