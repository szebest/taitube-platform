import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { PartyControlsRow, SettingsSectionPage } from '#app/features/account';

export const Route = createFileRoute('/settings/party-controls')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Party controls - Taitube' }] }),
  component: PartyControlsSettings,
});

function PartyControlsSettings() {
  return (
    <SettingsSectionPage section="partyControls">
      <PartyControlsRow />
    </SettingsSectionPage>
  );
}
