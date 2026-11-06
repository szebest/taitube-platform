import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AccessibilitySettings } from '#app/features/account/components/accessibility-settings/accessibility-settings';

export const Route = createFileRoute('/settings/accessibility')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Accessibility settings - Taitube' }] }),
  component: AccessibilitySettings,
});
