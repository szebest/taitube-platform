import { type ContrastFailure, checkContrast, NON_TEXT_FLOOR } from './contrast';
import { checkRoleContrast, type RoleContrast, type RolePairSet } from './schema/roles';
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

export type ThemeContrastFailure = ContrastFailure<LabelledPair> &
  Readonly<{ mode: ThemeMode; contrast: RoleContrast }>;

/**
 * Every required role pair, standard and under `data-contrast="more"`, and every chart series at 3:1 on
 * `surface`, in each mode of the theme. `core` leaves out the pairs only a shipped theme is chosen against.
 */
export const checkThemeContrast = (
  { color, dataviz }: ResolvedTheme,
  set: RolePairSet = 'drawn'
): ThemeContrastFailure[] =>
  MODE_PALETTES.flatMap(({ mode, palette }) => {
    const roles = mode === 'oled' ? { ...color.dark, ...color.oled } : color[mode];
    const series = dataviz[palette].map((foreground, index) => ({
      label: `series ${index + 1} on surface`,
      foreground,
      background: roles.surface,
      floor: NON_TEXT_FLOOR,
    }));
    return [
      ...checkRoleContrast(roles, 'standard', set).map((failure) => ({
        ...failure,
        contrast: 'standard' as const,
      })),
      ...(set === 'drawn' ? checkRoleContrast(roles, 'more', set) : []).map((failure) => ({
        ...failure,
        contrast: 'more' as const,
      })),
      ...checkContrast(series).map((failure) => ({ ...failure, contrast: 'standard' as const })),
    ].map((failure) => ({ ...failure, mode }));
  });
