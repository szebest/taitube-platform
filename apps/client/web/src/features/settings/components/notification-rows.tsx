import { useAccountPreference } from '../hooks/use-account-preference';
import { SettingSwitchRow } from './setting-switch-row';

export function SubscriptionUploadsRow() {
  const [on, setOn] = useAccountPreference('notifications', 'subscriptionUploads');

  return (
    <SettingSwitchRow
      row="subscription-uploads"
      setting="notifications.subscriptionUploads"
      checked={on}
      onCheckedChange={setOn}
    />
  );
}

export function RepliesAndMentionsRow() {
  const [on, setOn] = useAccountPreference('notifications', 'repliesAndMentions');

  return (
    <SettingSwitchRow
      row="replies-and-mentions"
      setting="notifications.repliesAndMentions"
      checked={on}
      onCheckedChange={setOn}
    />
  );
}

export function ProcessingFinishedRow() {
  const [on, setOn] = useAccountPreference('notifications', 'processingFinished');

  return (
    <SettingSwitchRow
      row="processing-finished"
      setting="notifications.processingFinished"
      checked={on}
      onCheckedChange={setOn}
    />
  );
}
