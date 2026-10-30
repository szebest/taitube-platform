import { PRIVACY_SETTINGS } from '@vp/domain/settings';
import { useT } from '@vp/intl-react';
import { Select } from '@vp/ui';

import { useAccountPreference } from '../hooks/use-account-preference';
import { SettingItem } from './setting-item';
import { SettingSwitchRow } from './setting-switch-row';

export function PauseHistoryRow() {
  const [paused, setPaused] = useAccountPreference('privacy', 'historyPaused');

  return (
    <SettingSwitchRow
      row="pause-history"
      setting="privacy.historyPaused"
      checked={paused}
      onCheckedChange={setPaused}
    />
  );
}

export function PlaylistVisibilityRow() {
  const [visibility, setVisibility] = useAccountPreference('privacy', 'playlistVisibility');
  const { tOr } = useT();

  return (
    <SettingItem
      row="playlist-visibility"
      setting="privacy.playlistVisibility"
      description={tOr('settings.rowDescription', { row: 'playlist-visibility' }, '')}
    >
      <Select.Root
        value={visibility}
        onValueChange={(next) => {
          const picked = PRIVACY_SETTINGS.playlistVisibility.options.find(
            (option) => option === next
          );
          if (picked) setVisibility(picked);
        }}
      >
        <Select.Trigger aria-label={tOr('settings.rowLabel', { row: 'playlist-visibility' }, '')}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {PRIVACY_SETTINGS.playlistVisibility.options.map((option) => (
            <Select.Item key={option} value={option}>
              {tOr('videos.visibility', { visibility: option }, '')}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </SettingItem>
  );
}

export function SubscriptionsVisibleRow() {
  const [visible, setVisible] = useAccountPreference('privacy', 'subscriptionsVisible');

  return (
    <SettingSwitchRow
      row="subscriptions-visible"
      setting="privacy.subscriptionsVisible"
      checked={visible}
      onCheckedChange={setVisible}
    />
  );
}
