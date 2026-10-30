import { MODE_OPTIONS, type ModeOption } from '@vp/design-tokens';
import { useState } from 'react';
import { IconButton } from '../primitives/icon-button';
import { type UiCopyKey, useUiCopy } from '../copy/ui-copy';
import { DropdownMenu } from '../primitives/dropdown-menu';
import { Icon } from '../primitives/icon';
import { Tooltip } from '../primitives/tooltip';
import { useAppearance } from './provider';
import { DENSITIES, type Density, useDensity } from './use-density';

const DENSITY_WORDS: Readonly<Record<Density, UiCopyKey>> = {
  comfortable: 'densityComfortable',
  compact: 'densityCompact',
};

const MODE_WORDS: Readonly<Record<ModeOption, UiCopyKey>> = {
  system: 'modeSystem',
  dark: 'modeDark',
  light: 'modeLight',
  oled: 'modeOled',
};

/**
 * The header's appearance control: the shown mode's icon, and a menu of themes, modes and the simple
 * density (compact is compact spacing and small sizing; comfortable is the theme's own).
 */
export function ThemeMenu() {
  const copy = useUiCopy();
  const { preference, resolved, shownMode, themes, update } = useAppearance();
  const { density, setDensity } = useDensity();
  const [picked, setPicked] = useState(false);

  return (
    <DropdownMenu.Root>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <DropdownMenu.Trigger asChild>
            <IconButton aria-label={copy.appearance}>
              <Icon
                key={shownMode}
                name={shownMode === 'light' ? 'sun' : 'moon'}
                className={picked ? 'tw:motion-safe:animate-spin-in' : undefined}
              />
            </IconButton>
          </DropdownMenu.Trigger>
        </Tooltip.Trigger>
        <Tooltip.Content>{copy.appearance}</Tooltip.Content>
      </Tooltip.Root>
      <DropdownMenu.Content align="end" className="tw:min-w-44">
        <DropdownMenu.Label>{copy.theme}</DropdownMenu.Label>
        <DropdownMenu.RadioGroup value={resolved.theme.id}>
          {themes.map(({ id, name }) => (
            <DropdownMenu.RadioItem key={id} value={id} onSelect={() => update({ theme: id })}>
              {name}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
        <DropdownMenu.Separator />
        <DropdownMenu.Label>{copy.mode}</DropdownMenu.Label>
        <DropdownMenu.RadioGroup value={preference.mode}>
          {MODE_OPTIONS.map((mode) => (
            <DropdownMenu.RadioItem
              key={mode}
              value={mode}
              onSelect={() => {
                setPicked(true);
                update({ mode });
              }}
            >
              {copy[MODE_WORDS[mode]]}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
        <DropdownMenu.Separator />
        <DropdownMenu.Label>{copy.density}</DropdownMenu.Label>
        <DropdownMenu.RadioGroup value={density}>
          {DENSITIES.map((option) => (
            <DropdownMenu.RadioItem
              key={option}
              value={option}
              onSelect={() => setDensity(option)}
            >
              {copy[DENSITY_WORDS[option]]}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
