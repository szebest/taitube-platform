import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { OfflineRoute } from '#app/features/offline';

export const Route = createFileRoute('/offline')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Offline - Taitube' }] }),
  component: OfflineRoute,
});
