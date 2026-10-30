import { useT } from '@vp/intl-react';
import { Button, useAppearance } from '@vp/ui';
import { useState } from 'react';

import { AccentRolesPreview } from './accent-roles-preview';
import { SettingItem } from './setting-item';

const NO_PICK = '#000000';

/** The accent: the theme's own, or a colour that is previewed with its derived roles before it is kept. */
export function AccentRow() {
  const { preference, update } = useAppearance();
  const { tOr } = useT();
  const [picked, setPicked] = useState<string>();

  const shown = picked ?? preference.accent;
  const pending = picked !== undefined && picked !== preference.accent;

  const keep = () => {
    update({ accent: picked ?? null });
    setPicked(undefined);
  };
  const useThemeAccent = () => {
    update({ accent: null });
    setPicked(undefined);
  };

  return (
    <SettingItem
      row="accent"
      setting="appearance.accent"
      stacked
      description={tOr('settings.rowDescription', { row: 'accent' }, '')}
    >
      <div className="tw:flex tw:flex-col tw:gap-stack">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-inline">
          <input
            type="color"
            aria-label={tOr('settings.accentPick', {}, '')}
            value={shown ?? NO_PICK}
            onChange={(event) => setPicked(event.target.value)}
            className="tw:h-control-md tw:w-16 tw:cursor-pointer tw:rounded-control tw:border-control tw:border-border-strong tw:bg-transparent tw:p-0 tw:focus-ring"
          />
          {pending && <Button onClick={keep}>{tOr('settings.accentUse', {}, '')}</Button>}
          <Button
            variant="ghost"
            disabled={preference.accent === null && picked === undefined}
            onClick={useThemeAccent}
          >
            {tOr('settings.accentOwn', {}, '')}
          </Button>
        </div>
        {shown !== null && <AccentRolesPreview hex={shown} />}
      </div>
    </SettingItem>
  );
}
