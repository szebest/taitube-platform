import { useQuery } from '@tanstack/react-query';
import type { SubscribedChannel } from '@vp/api-contracts';
import { NOTIFICATION_LEVELS } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useAccount, useApi, useFailureToast } from '@vp/queries';
import { Avatar, SegmentedControl } from '@vp/ui';
import { SettingRow } from '#app/components/settings/setting-row';
import { SettingsSection } from '#app/components/settings/settings-section';
import { mySubscriptionsQueryOptions } from '#app/features/subscriptions/api/subscription-queries';
import { useSetSubscriptionLevel } from '#app/features/subscriptions/hooks/use-set-subscription-level';

function ChannelLevelRow({ channel }: { channel: SubscribedChannel }) {
  const { tOr } = useT();
  const setLevel = useSetSubscriptionLevel(channel.id);
  const showFailure = useFailureToast();

  const choose = (picked: string) => {
    const level = NOTIFICATION_LEVELS.find((option) => option === picked);
    if (level === undefined) {
      return;
    }

    setLevel.mutate(level, {
      onError: (error) => showFailure(tOr('notifications.levelFailed', {}, ''), error),
    });
  };

  return (
    <SettingRow.Root>
      <SettingRow.Text className="flex-row items-center gap-stack">
        <Avatar.Root size="sm" aria-hidden="true">
          {channel.avatarUrl && <Avatar.Image src={channel.avatarUrl} alt="" />}
          <Avatar.Fallback>{channel.displayName.slice(0, 1)}</Avatar.Fallback>
        </Avatar.Root>
        <SettingRow.Label>{channel.displayName}</SettingRow.Label>
      </SettingRow.Text>
      <SettingRow.Control>
        <SegmentedControl.Root
          aria-label={tOr('notifications.levelLabel', { name: channel.displayName }, '')}
          value={channel.notificationLevel}
          onValueChange={choose}
        >
          {NOTIFICATION_LEVELS.map((level) => (
            <SegmentedControl.Item key={level} value={level}>
              {tOr('notifications.level', { level }, '')}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      </SettingRow.Control>
    </SettingRow.Root>
  );
}

/** Per subscribed channel, how much it may notify the signed-in viewer; nothing without a subscription. */
export function ChannelLevels() {
  const api = useApi();
  const account = useAccount();
  const { tOr } = useT();
  const { data } = useQuery({
    ...mySubscriptionsQueryOptions(api),
    enabled: account !== undefined,
  });

  if (!data?.items.length) {
    return null;
  }

  return (
    <SettingsSection.Root id="channel-overrides">
      <SettingsSection.Title>{tOr('notifications.channelsTitle', {}, '')}</SettingsSection.Title>
      <SettingsSection.Description>
        {tOr('notifications.channelsDescription', {}, '')}
      </SettingsSection.Description>
      <SettingsSection.Body>
        {data.items.map((channel) => (
          <ChannelLevelRow key={channel.id} channel={channel} />
        ))}
      </SettingsSection.Body>
    </SettingsSection.Root>
  );
}
