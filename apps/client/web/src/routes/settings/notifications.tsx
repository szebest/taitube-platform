import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ChannelLevels } from '#app/features/account/components/channel-levels/channel-levels';
import {
  ProcessingFinishedRow,
  RepliesAndMentionsRow,
  SubscriptionUploadsRow,
} from '#app/features/account/components/notification-rows/notification-rows';
import { SettingsSectionPage } from '#app/features/account/components/settings-section-page/settings-section-page';

export const Route = createFileRoute('/settings/notifications')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Notifications settings - Taitube' }] }),
  component: NotificationSettings,
});

function NotificationSettings() {
  return (
    <>
      <SettingsSectionPage section="notifications">
        <SubscriptionUploadsRow />
        <RepliesAndMentionsRow />
        <ProcessingFinishedRow />
      </SettingsSectionPage>
      <ChannelLevels />
    </>
  );
}
