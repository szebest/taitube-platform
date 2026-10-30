import { PLAYBACK_SETTINGS } from '@vp/domain/settings';
import { useT } from '@vp/intl-react';
import { Select } from '@vp/ui';

import { usePlaybackPreference } from '../device/device-preferences-provider';
import { SettingItem } from './setting-item';
import { SettingSwitchRow } from './setting-switch-row';

export function QualityRow() {
  const [quality, setQuality] = usePlaybackPreference('quality');
  const { tOr } = useT();

  return (
    <SettingItem
      row="quality"
      setting="playback.quality"
      description={tOr('settings.rowDescription', { row: 'quality' }, '')}
    >
      <Select.Root
        value={quality}
        onValueChange={(next) => {
          const picked = PLAYBACK_SETTINGS.quality.options.find((option) => option === next);
          if (picked) setQuality(picked);
        }}
      >
        <Select.Trigger aria-label={tOr('settings.rowLabel', { row: 'quality' }, '')}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {PLAYBACK_SETTINGS.quality.options.map((option) => (
            <Select.Item key={option} value={option}>
              {option === 'auto' ? tOr('player.autoQuality', {}, '') : option}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </SettingItem>
  );
}

export function SpeedRow() {
  const [speed, setSpeed] = usePlaybackPreference('speed');
  const { tOr } = useT();

  return (
    <SettingItem
      row="speed"
      setting="playback.speed"
      description={tOr('settings.rowDescription', { row: 'speed' }, '')}
    >
      <Select.Root
        value={String(speed)}
        onValueChange={(next) => {
          const picked = PLAYBACK_SETTINGS.speed.options.find((option) => String(option) === next);
          if (picked) setSpeed(picked);
        }}
      >
        <Select.Trigger aria-label={tOr('settings.rowLabel', { row: 'speed' }, '')}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {PLAYBACK_SETTINGS.speed.options.map((option) => (
            <Select.Item key={option} value={String(option)}>
              {option === 1
                ? tOr('player.normalSpeed', {}, '')
                : tOr('player.rate', { rate: option }, '')}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </SettingItem>
  );
}

export function HoverPreviewRow() {
  const [hoverPreview, setHoverPreview] = usePlaybackPreference('hoverPreview');

  return (
    <SettingSwitchRow
      row="hover-preview"
      setting="playback.hoverPreview"
      checked={hoverPreview}
      onCheckedChange={setHoverPreview}
    />
  );
}

export function StatsOverlayRow() {
  const [statsOverlay, setStatsOverlay] = usePlaybackPreference('statsOverlay');

  return (
    <SettingSwitchRow
      row="stats-overlay"
      setting="playback.statsOverlay"
      checked={statsOverlay}
      onCheckedChange={setStatsOverlay}
    />
  );
}
