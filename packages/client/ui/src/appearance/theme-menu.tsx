import { MODE_OPTIONS, type ModeOption } from '@vp/design-tokens';
import { useState } from 'react';
import { IconButton } from '../button';
import { type UiCopyKey, useUiCopy } from '../copy/ui-copy';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu';
import { Icon } from '../icon';
import { Tooltip } from '../tooltip';
import { useAppearance } from './provider';
import { appearance } from './registry';

const MODE_WORDS: Readonly<Record<ModeOption, UiCopyKey>> = {
  system: 'modeSystem',
  dark: 'modeDark',
  light: 'modeLight',
  oled: 'modeOled',
};

/** The header's appearance control: the shown mode's icon, and a menu of themes and modes. */
export function ThemeMenu() {
  const copy = useUiCopy();
  const { preference, resolved, shownMode, update } = useAppearance();
  const [picked, setPicked] = useState(false);

  return (
    <DropdownMenu>
      <Tooltip content={copy.appearance}>
        <DropdownMenuTrigger asChild>
          <IconButton aria-label={copy.appearance}>
            <Icon
              key={shownMode}
              name={shownMode === 'light' ? 'sun' : 'moon'}
              className={picked ? 'tw:motion-safe:animate-spin-in' : undefined}
            />
          </IconButton>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className="tw:min-w-44">
        <DropdownMenuLabel>{copy.theme}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={resolved.theme.id}>
          {appearance.themes.map(({ id, name }) => (
            <DropdownMenuRadioItem key={id} value={id} onSelect={() => update({ theme: id })}>
              {name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{copy.mode}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={preference.mode}>
          {MODE_OPTIONS.map((mode) => (
            <DropdownMenuRadioItem
              key={mode}
              value={mode}
              onSelect={() => {
                setPicked(true);
                update({ mode });
              }}
            >
              {copy[MODE_WORDS[mode]]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
