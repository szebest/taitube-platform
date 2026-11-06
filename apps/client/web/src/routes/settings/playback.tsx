import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AutoplayNextRow } from '#app/features/account/components/autoplay-next-row/autoplay-next-row';
import {
  HoverPreviewRow,
  QualityRow,
  SpeedRow,
  StatsOverlayRow,
} from '#app/features/account/components/playback-rows/playback-rows';
import { SettingsSectionPage } from '#app/features/account/components/settings-section-page/settings-section-page';

export const Route = createFileRoute('/settings/playback')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Playback settings - Taitube' }] }),
  component: PlaybackSettings,
});

function PlaybackSettings() {
  return (
    <SettingsSectionPage section="playback">
      <QualityRow />
      <SpeedRow />
      <AutoplayNextRow />
      <HoverPreviewRow />
      <StatsOverlayRow />
    </SettingsSectionPage>
  );
}
