import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { SettingsSectionPage } from '#app/features/settings/components/settings-section-page';

export const Route = createFileRoute('/settings/language')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Language settings - Taitube' }] }),
  component: LanguageSettings,
});

function LanguageSettings() {
  return <SettingsSectionPage section="language" />;
}
