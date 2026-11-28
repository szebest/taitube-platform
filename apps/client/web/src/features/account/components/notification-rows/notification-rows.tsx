import { Select } from '@kit/ui';
import { NOTIFICATION_SETTINGS } from '@vp/domain/settings';
import { useAccountPreference } from '#app/hooks/use-account-preference';
import { useT } from '#app/lib/messages';
import { SettingItem } from '../setting-item/setting-item';
import { SettingSwitchRow } from '../setting-switch-row/setting-switch-row';

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

export function WatchPartiesRow() {
  const [on, setOn] = useAccountPreference('notifications', 'watchParties');

  return (
    <SettingSwitchRow
      row="watch-parties"
      setting="notifications.watchParties"
      checked={on}
      onCheckedChange={setOn}
    />
  );
}

export function WatchPartyInvitesRow() {
  const [source, setSource] = useAccountPreference('notifications', 'watchPartyInvites');
  const { tOr } = useT();
  const { options } = NOTIFICATION_SETTINGS.watchPartyInvites;

  return (
    <SettingItem
      row="watch-party-invites"
      setting="notifications.watchPartyInvites"
      description={tOr('settings.rowDescription', { row: 'watch-party-invites' }, '')}
    >
      <Select.Root
        value={source}
        onValueChange={(next) => {
          const picked = options.find((option) => option === next);
          if (picked) setSource(picked);
        }}
      >
        <Select.Trigger aria-label={tOr('settings.rowLabel', { row: 'watch-party-invites' }, '')}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {options.map((option) => (
            <Select.Item key={option} value={option}>
              {tOr('party.inviteSource', { source: option }, '')}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </SettingItem>
  );
}
