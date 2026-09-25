import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { SubscriptionsPage } from 'src/modules/Subscriptions';

export const Route = createFileRoute('/_authed/subscriptions/')({
  validateSearch: z.object({}),
  component: SubscriptionsPage,
});
