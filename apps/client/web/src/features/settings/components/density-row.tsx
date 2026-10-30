import { useT } from '@vp/intl-react';
import { DENSITIES, SegmentedControl, useDensity } from '@vp/ui';

import { SettingItem } from './setting-item';

export function DensityRow() {
  const { density, setDensity } = useDensity();
  const { tOr } = useT();

  return (
    <SettingItem
      row="density"
      setting="appearance.overrides.spacing"
      description={tOr('settings.rowDescription', { row: 'density' }, '')}
    >
      <SegmentedControl.Root
        aria-label={tOr('settings.rowLabel', { row: 'density' }, '')}
        value={density}
        onValueChange={(picked) => {
          const option = DENSITIES.find((candidate) => candidate === picked);
          if (option !== undefined) setDensity(option);
        }}
      >
        {DENSITIES.map((option) => (
          <SegmentedControl.Item key={option} value={option}>
            {tOr('settings.densityOption', { density: option }, '')}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
    </SettingItem>
  );
}
