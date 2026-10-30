import { useT } from '@vp/intl-react';
import { Switch } from '@vp/ui';

import { usePlaybackPreference } from '../device/device-preferences-provider';
import { SettingItem } from './setting-item';

/** The playback section's autoplay switch, on the store's `autoplayNext`. */
export function AutoplayNextRow() {
  const [autoplayNext, setAutoplayNext] = usePlaybackPreference('autoplayNext');
  const { tOr } = useT();

  return (
    <SettingItem row="autoplay-next" setting="playback.autoplayNext">
      <Switch
        aria-label={tOr('settings.rowLabel', { row: 'autoplay-next' }, '')}
        checked={autoplayNext}
        onCheckedChange={setAutoplayNext}
      />
    </SettingItem>
  );
}
