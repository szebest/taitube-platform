import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { AutoplayNextRow } from '#app/features/settings/components/autoplay-next-row';
import { SettingsSectionPage } from '#app/features/settings/components/settings-section-page';

export const Route = createFileRoute('/settings/playback')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Playback settings - Taitube' }] }),
  component: PlaybackSettings,
});

function PlaybackSettings() {
  return (
    <SettingsSectionPage section="playback">
      <AutoplayNextRow />
    </SettingsSectionPage>
  );
}
