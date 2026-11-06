import { useT } from '@vp/intl-react';
import { Button, useAppearance } from '@vp/ui';
import { useState } from 'react';
import { AccentRolesPreview } from '../accent-roles-preview/accent-roles-preview';
import { SettingItem } from '../setting-item/setting-item';

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
      <div className="flex flex-col gap-stack">
        <div className="flex flex-wrap items-center gap-inline">
          <input
            type="color"
            aria-label={tOr('settings.accentPick', {}, '')}
            key={preference.accent ?? 'theme'}
            defaultValue={preference.accent ?? undefined}
            onChange={(event) => setPicked(event.target.value)}
            className="h-control-md w-16 cursor-pointer rounded-control border-control border-border-strong bg-transparent p-0 focus-ring"
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
