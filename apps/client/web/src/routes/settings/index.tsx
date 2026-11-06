import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { SettingsOverview } from '#app/features/account/components/settings-overview/settings-overview';

export const Route = createFileRoute('/settings/')({
  validateSearch: z.object({ find: z.string().optional() }),
  component: SettingsOverview,
});
