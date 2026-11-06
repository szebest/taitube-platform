import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  ChannelLevels,
  ProcessingFinishedRow,
  RepliesAndMentionsRow,
  SettingsSectionPage,
  SubscriptionUploadsRow,
} from '#app/features/account';

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
