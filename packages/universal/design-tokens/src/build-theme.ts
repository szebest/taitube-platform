import { andThen, err, map, ok, type Result } from '@vp/result';
import { type DerivedAccent, deriveAccent, groundsInsideAccentBand } from './accent';
import {
  composite,
  formatHex,
  type InvalidColour,
  invalidColour,
  parseGround,
  type Rgba,
  snapToBytes,
} from './color/rgb';
import { contrastBetween } from './contrast';
import type { ColorRole } from './schema/roles';
import type { Theme } from './schema/theme';
import type { HexColor, ModeFamily } from './schema/values';

export type ThemeColours = Readonly<{ ground: string; accent: string }>;

const BLACK: Rgba = { r: 0, g: 0, b: 0, alpha: 1 };

const WHITE: Rgba = { r: 1, g: 1, b: 1, alpha: 1 };

const familyOf = (ground: Rgba): ModeFamily =>
  contrastBetween(WHITE, ground) >= contrastBetween(BLACK, ground) ? 'dark' : 'light';

const SURFACE_STRENGTH = 0.06;
const RAISED_STRENGTH = 0.1;
const BORDER_STRENGTH = 0.16;
const BORDER_STRONG_STRENGTH = 0.55;
const MUTED_STRENGTH = 0.72;
const SUBTLE_STRENGTH = 0.6;

const groundRoles = (ground: Rgba, family: ModeFamily): Partial<Record<ColorRole, HexColor>> => {
  const text = family === 'dark' ? WHITE : BLACK;
  const mixed = (colour: Rgba, strength: number) =>
    formatHex(snapToBytes(composite({ ...colour, alpha: strength }, ground)));
  return {
    bg: formatHex(ground),
    surface: mixed(WHITE, SURFACE_STRENGTH),
    raised: mixed(WHITE, RAISED_STRENGTH),
    border: mixed(text, BORDER_STRENGTH),
    'border-strong': mixed(text, BORDER_STRONG_STRENGTH),
    fg: formatHex(text),
    'fg-muted': mixed(text, MUTED_STRENGTH),
    'fg-subtle': mixed(text, SUBTLE_STRENGTH),
  };
};

const accentRoles = ({
  accent,
  accentHover,
  accentSoft,
  onAccent,
  accentInk,
}: DerivedAccent): Partial<Record<ColorRole, HexColor>> => ({
  accent,
  'accent-hover': accentHover,
  'accent-soft': accentSoft,
  'on-accent': onAccent,
  'accent-ink': accentInk,
  'focus-ring': accent,
});

const insideAccentBand = (ground: string, colour: Rgba): Result<true, InvalidColour> =>
  groundsInsideAccentBand([ground], familyOf(colour))
    ? ok(true)
    : err(
        invalidColour(
          'ground',
          ground,
          'ground is outside the range of page colours accents are derived for'
        )
      );

/**
 * A theme over `base`'s remaining roles, defaults and charts: `ground` becomes the page, its
 * surfaces, borders and text in the mode family it reads best in, and `accent` the derived accent
 * set in both families. The result is a theme like any other, so the contrast gate in
 * `registerTheme` still decides whether it may be used. A ground outside the band the accents are
 * derived for is refused, since an accent derived for that band can miss its floors on it.
 */
export const buildTheme = (
  base: Theme,
  { id, name }: Pick<Theme, 'id' | 'name'>,
  { ground, accent }: ThemeColours
): Result<Theme, InvalidColour> =>
  andThen(parseGround(ground), (groundColour) =>
    andThen(insideAccentBand(ground, groundColour), () =>
      andThen(deriveAccent(accent, 'dark'), (dark) =>
        map(deriveAccent(accent, 'light'), (light) => {
          const groundFamily = familyOf(groundColour);
          const roles = (family: ModeFamily, derived: DerivedAccent) => ({
            ...base.color[family],
            ...(family === groundFamily ? groundRoles(groundColour, family) : {}),
            ...accentRoles(derived),
          });
          return {
            ...base,
            id,
            name,
            color: { ...base.color, dark: roles('dark', dark), light: roles('light', light) },
          };
        })
      )
    )
  );
