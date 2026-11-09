import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { SettingsOverview } from '#app/features/account';

export const Route = createFileRoute('/settings/')({
  validateSearch: z.object({ find: z.string().optional() }),
  component: SettingsOverview,
});
