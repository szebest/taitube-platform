import { type HexColor, type ModeOption, resolveTheme, type Theme } from '@vp/design-tokens';
import { ramps } from '@vp/ui/tokens/ref';

type ShownMode = Exclude<ModeOption, 'system'>;

export type ThemeColorMeta = {
  media?: string;
  content: HexColor;
};

const MEDIA = {
  dark: '(prefers-color-scheme: dark)',
  light: '(prefers-color-scheme: light)',
} as const;

/** The `bg` role of `theme` in `mode`, as a hex colour; `oled` falls back to dark where the theme leaves it unset. */
export function themeBackground(theme: Theme, mode: ShownMode): HexColor | undefined {
  const resolved = resolveTheme(theme, ramps);
  if (!resolved.ok) {
    return undefined;
  }

  const { color } = resolved.value;
  return mode === 'oled' ? (color.oled.bg ?? color.dark.bg) : color[mode].bg;
}

function metaFor(theme: Theme, mode: ShownMode, media?: string): ThemeColorMeta[] {
  const content = themeBackground(theme, mode);
  return content === undefined ? [] : [{ ...(media ? { media } : {}), content }];
}

/** One tag per colour scheme when the mode follows the system, otherwise the one tag of the chosen mode. */
export function themeColorMetas(theme: Theme, mode: ModeOption): ThemeColorMeta[] {
  if (mode === 'system') {
    return [...metaFor(theme, 'dark', MEDIA.dark), ...metaFor(theme, 'light', MEDIA.light)];
  }

  return metaFor(theme, mode);
}
