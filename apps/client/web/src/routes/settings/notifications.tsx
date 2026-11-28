import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  ProcessingFinishedRow,
  RepliesAndMentionsRow,
  SettingsSectionPage,
  SubscriptionUploadsRow,
  WatchPartiesRow,
  WatchPartyInvitesRow,
} from '#app/features/account';
import { ChannelLevels } from '#app/features/library';

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
        <WatchPartiesRow />
        <WatchPartyInvitesRow />
      </SettingsSectionPage>
      <ChannelLevels />
    </>
  );
}
