import { ErrorCodes } from '@vp/errors';
import { useT } from '@vp/intl-react';
import { Button, CUSTOM_THEME_ID, registerCustomTheme, useAppearance } from '@vp/ui';
import { useState } from 'react';

import { SettingItem } from './setting-item';

const STARTING_GROUND = '#14110d';

const STARTING_ACCENT = '#c9a66b';

const colourInput =
  'tw:h-control-md tw:w-16 tw:cursor-pointer tw:rounded-control tw:border-control tw:border-border-strong tw:bg-transparent tw:p-0 tw:focus-ring';

/** A page colour and an accent that build a theme, which is kept only when it passes the contrast gate. */
export function BuildThemeRow() {
  const { preference, update } = useAppearance();
  const { tOr } = useT();
  const [ground, setGround] = useState(preference.customGround ?? STARTING_GROUND);
  const [accent, setAccent] = useState(preference.customAccent ?? STARTING_ACCENT);

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
      <div className="tw:flex tw:flex-col tw:gap-stack">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-inline">
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
          <p role="status" className="tw:m-0 tw:text-body-sm tw:text-fg-muted">
            {tOr('themeBuilder.passes', {}, '')}
          </p>
        ) : (
          <div role="alert" className="tw:flex tw:flex-col tw:gap-inline">
            <p className="tw:m-0 tw:text-body-sm tw:text-danger-ink">
              {tOr('themeBuilder.fails', { count: failing.length }, '')}
            </p>
            <ul className="tw:m-0 tw:list-none tw:p-0 tw:text-body-sm tw:text-fg-muted">
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
