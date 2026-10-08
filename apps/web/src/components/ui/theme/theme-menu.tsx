import { type LucideIcon, Monitor, Moon, Sun } from 'lucide-react';

import { IconButton } from '../button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../dropdown-menu';
import { variantNames } from '../variant-names';
import type { ThemePreference } from './theme-preference';
import { useTheme } from './theme-provider';

const OPTIONS: Record<ThemePreference, { label: string; Icon: LucideIcon }> = {
  light: { label: 'Light', Icon: Sun },
  dark: { label: 'Dark', Icon: Moon },
  system: { label: 'System', Icon: Monitor },
};

const PREFERENCES = variantNames(OPTIONS);

/** The header's theme control: an icon for the current choice, and a menu of all three. */
export function ThemeMenu() {
  const { preference, setPreference } = useTheme();
  const { label, Icon } = OPTIONS[preference];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton aria-label={`Theme: ${label}`}>
          <Icon aria-hidden="true" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => {
            const picked = PREFERENCES.find((option) => option === value);
            if (picked) setPreference(picked);
          }}
        >
          {PREFERENCES.map((option) => {
            const { label: optionLabel, Icon: OptionIcon } = OPTIONS[option];
            return (
              <DropdownMenuRadioItem key={option} value={option}>
                <OptionIcon aria-hidden="true" />
                {optionLabel}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
