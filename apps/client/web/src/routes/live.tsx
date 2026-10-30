import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { LivePage } from '#app/features/live/components/live-page';

export const Route = createFileRoute('/live')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Live - Taitube' }] }),
  component: LivePage,
});
