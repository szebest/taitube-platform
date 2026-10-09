import { type LucideIcon, Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';

import { IconButton } from '../button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../dropdown-menu';
import { THEME_PREFERENCES, type ThemePreference } from './theme-preference';
import { useTheme } from './theme-provider';

const OPTIONS: Record<ThemePreference, { label: string; Icon: LucideIcon }> = {
  light: { label: 'Light', Icon: Sun },
  dark: { label: 'Dark', Icon: Moon },
  system: { label: 'System', Icon: Monitor },
};

/** The header's theme control: an icon for the current choice, and a menu of all three. */
export function ThemeMenu() {
  const { preference, setPreference } = useTheme();
  const [picked, setPicked] = useState(false);
  const { label, Icon } = OPTIONS[preference];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton aria-label={`Theme: ${label}`}>
          <Icon
            key={preference}
            aria-hidden="true"
            className={picked ? 'tw:motion-safe:animate-spin-in' : undefined}
          />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="tw:min-w-44">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={preference}>
          {THEME_PREFERENCES.map((option) => {
            const { label: optionLabel, Icon: OptionIcon } = OPTIONS[option];
            return (
              <DropdownMenuRadioItem
                key={option}
                value={option}
                onSelect={() => {
                  setPicked(true);
                  setPreference(option);
                }}
              >
                <OptionIcon aria-hidden="true" className="tw:text-fg-muted" />
                {optionLabel}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
