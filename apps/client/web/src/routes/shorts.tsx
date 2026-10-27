import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { ShortsPage } from '#app/features/shorts/components/shorts-page';

export const Route = createFileRoute('/shorts')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Shorts - Taitube' }] }),
  component: ShortsPage,
});
