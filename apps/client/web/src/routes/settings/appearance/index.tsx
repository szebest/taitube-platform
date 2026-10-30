import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { AppearanceSettings } from '#app/features/settings/components/appearance-settings';

export const Route = createFileRoute('/settings/appearance/')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Appearance settings - Taitube' }] }),
  component: AppearanceSettings,
});
