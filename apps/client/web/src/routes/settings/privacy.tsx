import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ClearHistoryRow } from '#app/features/account/components/clear-history-row/clear-history-row';
import { HiddenRecommendationsRow } from '#app/features/account/components/hidden-recommendations-row/hidden-recommendations-row';
import {
  PauseHistoryRow,
  PlaylistVisibilityRow,
  SubscriptionsVisibleRow,
} from '#app/features/account/components/privacy-rows/privacy-rows';
import { SettingsSectionPage } from '#app/features/account/components/settings-section-page/settings-section-page';

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
