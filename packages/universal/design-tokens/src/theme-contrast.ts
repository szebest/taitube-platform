import { type ContrastFailure, checkContrast, NON_TEXT_FLOOR } from './contrast';
import { checkRoleContrast } from './schema/roles';
import type { ModeOption, ResolvedTheme } from './schema/theme';

type ThemeMode = Exclude<ModeOption, 'system'>;

const MODE_PALETTES = [
  { mode: 'dark', palette: 'categorical-dark' },
  { mode: 'light', palette: 'categorical-light' },
  { mode: 'oled', palette: 'categorical-dark' },
] as const satisfies readonly { mode: ThemeMode; palette: keyof ResolvedTheme['dataviz'] }[];

type LabelledPair = Readonly<{
  label: string;
  foreground: string;
  background: string;
  floor: number;
}>;

export type ThemeContrastFailure = ContrastFailure<LabelledPair> & Readonly<{ mode: ThemeMode }>;

/** Every required role pair and every chart series at 3:1 on `surface`, in each mode of the theme. */
export const checkThemeContrast = ({ color, dataviz }: ResolvedTheme): ThemeContrastFailure[] =>
  MODE_PALETTES.flatMap(({ mode, palette }) => {
    const roles = mode === 'oled' ? { ...color.dark, ...color.oled } : color[mode];
    const series = dataviz[palette].map((foreground, index) => ({
      label: `series ${index + 1} on surface`,
      foreground,
      background: roles.surface,
      floor: NON_TEXT_FLOOR,
    }));
    return [...checkRoleContrast(roles), ...checkContrast(series)].map((failure) => ({
      ...failure,
      mode,
    }));
  });
