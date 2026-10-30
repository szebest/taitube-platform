import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { SettingsSectionPage } from '#app/features/settings/components/settings-section-page';

export const Route = createFileRoute('/settings/appearance/')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Appearance settings - Taitube' }] }),
  component: AppearanceSettings,
});

function AppearanceSettings() {
  return <SettingsSectionPage section="appearance" />;
}
