import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { LanguageRow } from '#app/features/account/components/language-row/language-row';
import { SettingsSectionPage } from '#app/features/account/components/settings-section-page/settings-section-page';

export const Route = createFileRoute('/settings/language')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Language settings - Taitube' }] }),
  component: LanguageSettings,
});

function LanguageSettings() {
  return (
    <SettingsSectionPage section="language">
      <LanguageRow />
    </SettingsSectionPage>
  );
}
