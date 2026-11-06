import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  ClearHistoryRow,
  HiddenRecommendationsRow,
  PauseHistoryRow,
  PlaylistVisibilityRow,
  SettingsSectionPage,
  SubscriptionsVisibleRow,
} from '#app/features/account';

export const Route = createFileRoute('/settings/privacy')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Privacy settings - Taitube' }] }),
  component: PrivacySettings,
});

function PrivacySettings() {
  return (
    <SettingsSectionPage section="privacy">
      <PauseHistoryRow />
      <ClearHistoryRow />
      <HiddenRecommendationsRow />
      <PlaylistVisibilityRow />
      <SubscriptionsVisibleRow />
    </SettingsSectionPage>
  );
}
