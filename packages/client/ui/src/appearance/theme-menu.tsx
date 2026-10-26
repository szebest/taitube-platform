import { MODE_OPTIONS, type ModeOption } from '@vp/design-tokens';
import { useState } from 'react';
import { IconButton } from '../primitives/icon-button';
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
import { Icon } from '../primitives/icon';
import { Tooltip } from '../primitives/tooltip';
import { useAppearance } from './provider';
import { appearance } from './registry';

const COMPACT = { spacing: 'compact', sizing: 'small' } as const;

const DENSITIES = ['comfortable', 'compact'] as const;

const DENSITY_WORDS: Readonly<Record<(typeof DENSITIES)[number], UiCopyKey>> = {
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
  const { preference, resolved, shownMode, update, setOverride, resetOverrides, appDefaults } =
    useAppearance();
  const [picked, setPicked] = useState(false);

  const density =
    resolved.sets.spacing.id === COMPACT.spacing && resolved.sets.sizing.id === COMPACT.sizing
      ? 'compact'
      : 'comfortable';

  const pickDensity = (picked: (typeof DENSITIES)[number]) => {
    for (const group of ['spacing', 'sizing'] as const) {
      if (picked === 'compact') {
        setOverride(group, COMPACT[group]);
      } else if (appDefaults[group] === undefined) {
        resetOverrides(group);
      } else {
        // An app that starts compact (the studio) would come back compact from a reset.
        setOverride(group, resolved.theme.defaults[group].id);
      }
    }
  };

  return (
    <DropdownMenu>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <DropdownMenuTrigger asChild>
            <IconButton aria-label={copy.appearance}>
              <Icon
                key={shownMode}
                name={shownMode === 'light' ? 'sun' : 'moon'}
                className={picked ? 'tw:motion-safe:animate-spin-in' : undefined}
              />
            </IconButton>
          </DropdownMenuTrigger>
        </Tooltip.Trigger>
        <Tooltip.Content>{copy.appearance}</Tooltip.Content>
      </Tooltip.Root>
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
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{copy.density}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={density}>
          {DENSITIES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} onSelect={() => pickDensity(option)}>
              {copy[DENSITY_WORDS[option]]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
