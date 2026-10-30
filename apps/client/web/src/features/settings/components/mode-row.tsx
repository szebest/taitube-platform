import { MODE_OPTIONS } from '@vp/design-tokens';
import { useT } from '@vp/intl-react';
import { SegmentedControl, useAppearance } from '@vp/ui';

import { SettingItem } from './setting-item';

export function ModeRow() {
  const { preference, update } = useAppearance();
  const { tOr } = useT();

  return (
    <SettingItem
      row="mode"
      setting="appearance.mode"
      description={tOr('settings.rowDescription', { row: 'mode' }, '')}
    >
      <SegmentedControl.Root
        aria-label={tOr('settings.rowLabel', { row: 'mode' }, '')}
        value={preference.mode}
        onValueChange={(picked) => {
          const mode = MODE_OPTIONS.find((candidate) => candidate === picked);
          if (mode !== undefined) update({ mode });
        }}
      >
        {MODE_OPTIONS.map((mode) => (
          <SegmentedControl.Item key={mode} value={mode}>
            {tOr('settings.modeOption', { mode }, '')}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
    </SettingItem>
  );
}
