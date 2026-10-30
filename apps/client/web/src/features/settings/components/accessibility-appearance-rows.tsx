import { useT } from '@vp/intl-react';
import {
  PREFERS_REDUCED_MOTION,
  SegmentedControl,
  Switch,
  useAppearance,
  useMediaQuery,
} from '@vp/ui';

import { useTokenOverride } from '../hooks/use-token-override';
import { setName } from '../set-name';
import { SettingItem } from './setting-item';

export function FontSizeRow() {
  const { sets, shown, choose } = useTokenOverride('fontSize');
  const { tOr } = useT();

  return (
    <SettingItem
      row="font-size"
      setting="appearance.overrides.fontSize"
      description={tOr('settings.rowDescription', { row: 'font-size' }, '')}
    >
      <SegmentedControl.Root
        aria-label={tOr('settings.rowLabel', { row: 'font-size' }, '')}
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

export function ContrastRow() {
  const { preference, update } = useAppearance();
  const { tOr } = useT();

  return (
    <SettingItem
      row="contrast"
      setting="appearance.contrast"
      description={tOr('settings.rowDescription', { row: 'contrast' }, '')}
    >
      <Switch
        aria-label={tOr('settings.contrastMore', {}, '')}
        checked={preference.contrast === 'more'}
        onCheckedChange={(more) => update({ contrast: more ? 'more' : 'standard' })}
      />
    </SettingItem>
  );
}

/** The viewer's motion choice, with the system's request to reduce it named as the one that always wins. */
export function MotionRow() {
  const { sets, defaultSet, override, choose } = useTokenOverride('motion');
  const systemReduces = useMediaQuery(PREFERS_REDUCED_MOTION);
  const { tOr } = useT();

  return (
    <SettingItem
      row="reduced-motion"
      setting="appearance.overrides.motion"
      description={
        <>
          {tOr('settings.rowDescription', { row: 'reduced-motion' }, '')}
          {systemReduces && ` ${tOr('settings.systemMotion', {}, '')}`}
        </>
      }
    >
      <SegmentedControl.Root
        aria-label={tOr('settings.rowLabel', { row: 'reduced-motion' }, '')}
        value={override ?? defaultSet.id}
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

const BOLD = 'bold';

export function BordersRow() {
  const { shown, choose, reset } = useTokenOverride('border');
  const { tOr } = useT();

  return (
    <SettingItem
      row="bold-borders"
      setting="appearance.overrides.border"
      description={tOr('settings.rowDescription', { row: 'bold-borders' }, '')}
    >
      <Switch
        aria-label={tOr('settings.rowLabel', { row: 'bold-borders' }, '')}
        checked={shown.id === BOLD}
        onCheckedChange={(bold) => (bold ? choose(BOLD) : reset())}
      />
    </SettingItem>
  );
}
