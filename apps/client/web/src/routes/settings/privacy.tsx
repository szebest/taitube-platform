import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { SettingsSectionPage } from '#app/features/settings/components/settings-section-page';

export const Route = createFileRoute('/settings/privacy')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Privacy settings - Taitube' }] }),
  component: PrivacySettings,
});

function PrivacySettings() {
  return <SettingsSectionPage section="privacy" />;
}
