import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { SettingsSectionPage } from '#app/features/settings/components/settings-section-page';

export const Route = createFileRoute('/settings/appearance/advanced')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Fine-tune the look - Taitube' }] }),
  component: AdvancedAppearanceSettings,
});

function AdvancedAppearanceSettings() {
  return <SettingsSectionPage section="advanced" />;
}
