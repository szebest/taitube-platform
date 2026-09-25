import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { SubscriptionVideosPage } from 'src/modules/SubscriptionVideos';

export const Route = createFileRoute('/_authed/subscriptions/videos')({
  validateSearch: z.object({}),
  component: SubscriptionVideosPage,
});
