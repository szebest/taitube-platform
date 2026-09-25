import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { SubscriptionsPage } from '#app/modules/Subscriptions';

export const Route = createFileRoute('/_authed/subscriptions/')({
  validateSearch: z.object({}),
  component: SubscriptionsPage,
});
