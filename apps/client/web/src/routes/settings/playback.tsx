import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  AutoplayNextRow,
  HoverPreviewRow,
  QualityRow,
  SettingsSectionPage,
  SpeedRow,
  StatsOverlayRow,
} from '#app/features/account';

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
