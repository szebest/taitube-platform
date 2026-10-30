import { useT } from '@vp/intl-react';
import { Switch } from '@vp/ui';

import { SettingItem } from './setting-item';

type SwitchRowId =
  | 'autoplay-next'
  | 'hover-preview'
  | 'stats-overlay'
  | 'pause-history'
  | 'subscriptions-visible'
  | 'subscription-uploads'
  | 'replies-and-mentions'
  | 'processing-finished';

export type SettingSwitchRowProps = {
  row: SwitchRowId;
  setting: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** A setting that is on or off: the row's label and description with a switch on the value. */
export function SettingSwitchRow({
  row,
  setting,
  checked,
  onCheckedChange,
}: SettingSwitchRowProps) {
  const { tOr } = useT();

  return (
    <SettingItem
      row={row}
      setting={setting}
      description={tOr('settings.rowDescription', { row }, '')}
    >
      <Switch
        aria-label={tOr('settings.rowLabel', { row }, '')}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </SettingItem>
  );
}
