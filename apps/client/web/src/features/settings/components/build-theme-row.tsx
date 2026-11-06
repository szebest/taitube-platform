import { ErrorCodes } from '@vp/errors';
import { useT } from '@vp/intl-react';
import {
  Button,
  CUSTOM_THEME_ID,
  CUSTOM_THEME_START,
  registerCustomTheme,
  useAppearance,
} from '@vp/ui';
import { useState } from 'react';
import { SettingItem } from './setting-item';

const colourInput =
  'h-control-md w-16 cursor-pointer rounded-control border-control border-border-strong bg-transparent p-0 focus-ring';

/** A page colour and an accent that build a theme, which is kept only when it passes the contrast gate. */
export function BuildThemeRow() {
  const { preference, update } = useAppearance();
  const { tOr } = useT();
  const [ground, setGround] = useState(preference.customGround ?? CUSTOM_THEME_START.ground);
  const [accent, setAccent] = useState(preference.customAccent ?? CUSTOM_THEME_START.accent);

  const built = registerCustomTheme({ ground, accent }, null);
  const failing =
    !built.ok && built.error.code === ErrorCodes.VALIDATION_FAILED ? built.error.pairs : [];

  const keep = () => {
    if (built.ok) update({ theme: CUSTOM_THEME_ID, customGround: ground, customAccent: accent });
  };

  return (
    <SettingItem
      row="buildTheme"
      setting="appearance.customGround"
      stacked
      description={tOr('settings.rowDescription', { row: 'buildTheme' }, '')}
    >
      <div className="flex flex-col gap-stack">
        <div className="flex flex-wrap items-center gap-inline">
          <input
            type="color"
            aria-label={tOr('themeBuilder.ground', {}, '')}
            value={ground}
            onChange={(event) => setGround(event.target.value)}
            className={colourInput}
          />
          <input
            type="color"
            aria-label={tOr('themeBuilder.accent', {}, '')}
            value={accent}
            onChange={(event) => setAccent(event.target.value)}
            className={colourInput}
          />
          <Button disabled={!built.ok} onClick={keep}>
            {tOr('themeBuilder.use', {}, '')}
          </Button>
        </div>
        {built.ok ? (
          <p className="m-0 text-body-sm text-fg-muted">{tOr('themeBuilder.passes', {}, '')}</p>
        ) : (
          <div role="alert" className="flex flex-col gap-inline">
            <p className="m-0 text-body-sm text-danger-ink">
              {failing.length > 0
                ? tOr('themeBuilder.fails', { count: failing.length }, '')
                : tOr('themeBuilder.refused', {}, '')}
            </p>
            <ul className="m-0 list-none p-0 text-body-sm text-fg-muted">
              {failing.map(({ mode, label, ratio, floor }) => (
                <li key={`${mode} ${label}`}>
                  {tOr('themeBuilder.failure', { mode, label, ratio, floor }, '')}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SettingItem>
  );
}
