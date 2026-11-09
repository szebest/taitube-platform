import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { LanguageRow, SettingsSectionPage } from '#app/features/account';

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
