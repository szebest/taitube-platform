import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { SettingsSectionPage } from '#app/features/settings/components/settings-section-page';

export const Route = createFileRoute('/settings/accessibility')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Accessibility settings - Taitube' }] }),
  component: AccessibilitySettings,
});

function AccessibilitySettings() {
  return <SettingsSectionPage section="accessibility" />;
}
