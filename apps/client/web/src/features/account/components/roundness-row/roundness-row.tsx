import { useT } from '@vp/intl-react';
import { SegmentedControl } from '@vp/ui';
import { useTokenOverride } from '#app/features/account/hooks/use-token-override';
import { setName } from '#app/features/account/utils/set-name';
import { SettingItem } from '../setting-item/setting-item';

/** How round buttons, cards and inputs are: the `radius` token set, the same one Advanced writes. */
export function RoundnessRow() {
  const { sets, shown, choose } = useTokenOverride('radius');
  const { tOr } = useT();

  return (
    <SettingItem
      row="roundness"
      setting="appearance.overrides.radius"
      description={tOr('settings.rowDescription', { row: 'roundness' }, '')}
    >
      <SegmentedControl.Root
        aria-label={tOr('settings.rowLabel', { row: 'roundness' }, '')}
        value={shown.id}
        onValueChange={choose}
      >
        {sets.map(({ id }) => (
          <SegmentedControl.Item key={id} value={id}>
            {setName(id)}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
    </SettingItem>
  );
}
