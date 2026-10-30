import { usePlaybackPreference } from '../device/device-preferences-provider';
import { SettingSwitchRow } from './setting-switch-row';

/** The playback section's autoplay switch, on the store's `autoplayNext`. */
export function AutoplayNextRow() {
  const [autoplayNext, setAutoplayNext] = usePlaybackPreference('autoplayNext');

  return (
    <SettingSwitchRow
      row="autoplay-next"
      setting="playback.autoplayNext"
      checked={autoplayNext}
      onCheckedChange={setAutoplayNext}
    />
  );
}
