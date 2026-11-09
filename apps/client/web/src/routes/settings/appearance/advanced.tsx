import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AdvancedSettings } from '#app/features/account';

export const Route = createFileRoute('/settings/appearance/advanced')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Fine-tune the look - Taitube' }] }),
  component: AdvancedSettings,
});
