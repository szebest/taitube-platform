import { map, type Result, unwrapOr } from '@vp/result';
import { fromOklch, type Oklch, toOklch } from './color/oklch';
import {
  composite,
  formatHex,
  type InvalidColour,
  overGround,
  parseGround,
  type Rgba,
  snapToBytes,
} from './color/rgb';
import { contrastBetween, relativeLuminance } from './contrast';

export type ModeFamily = 'dark' | 'light';

// The lightest dark and the darkest light ground a theme may put the accent on:
// an accent clearing its floor here clears it on every ground further out.
export const ACCENT_GROUNDS: Readonly<Record<ModeFamily, string>> = {
  dark: '#262626',
  light: '#EBEBEB',
};

const luminanceOf = (ground: string) => unwrapOr(map(parseGround(ground), relativeLuminance), NaN);

const INSIDE_BAND: Readonly<Record<ModeFamily, (ground: number, edge: number) => boolean>> = {
  dark: (ground, edge) => ground <= edge,
  light: (ground, edge) => ground >= edge,
};

export const groundsInsideAccentBand = (grounds: readonly string[], family: ModeFamily) =>
  grounds.every((ground) =>
    INSIDE_BAND[family](luminanceOf(ground), luminanceOf(ACCENT_GROUNDS[family]))
  );

export type DerivedAccent = Readonly<{
  /** The fill and the focus ring: at least 3:1 against `ACCENT_GROUNDS[family]`. */
  accent: string;
  /**
   * The fill on hover, up to 0.05 OKLCH lightness away from `onAccent`: at least 4.5:1 under it and
   * 3:1 against `ACCENT_GROUNDS[family]`, or `accent` itself where no step holds both.
   */
  accentHover: string;
  /** `accent` at alpha `29`: a selected item or a soft badge ground. */
  accentSoft: string;
  /** Black or white, whichever reads better: at least 4.5:1 on `accent` and `accentHover`. */
  onAccent: string;
  /** The accent as text: at least 4.5:1 on `ACCENT_GROUNDS[family]` and on `accentSoft` over it. */
  accentInk: string;
}>;

const NON_TEXT_FLOOR = 3;

const TEXT_FLOOR = 4.5;

const BLACK: Rgba = { r: 0, g: 0, b: 0, alpha: 1 };

const WHITE: Rgba = { r: 1, g: 1, b: 1, alpha: 1 };

const LIGHTNESS_STEP = 0.01;

const STEPS_ACROSS_LIGHTNESS = 1 / LIGHTNESS_STEP;

const HOVER_STEPS = 5;

const SOFT_ALPHA = 0x29 / 255;

type Direction = 1 | -1;

const AWAY_FROM_GROUND: Readonly<Record<ModeFamily, Direction>> = { dark: 1, light: -1 };

const shift = (color: Oklch, by: number): Oklch => ({ ...color, l: color.l + by });

const stepUntil = (start: Oklch, direction: Direction, accepts: (candidate: Rgba) => boolean) => {
  for (let step = 0; step <= STEPS_ACROSS_LIGHTNESS; step++) {
    const candidate = snapToBytes(fromOklch(shift(start, direction * step * LIGHTNESS_STEP)));
    if (accepts(candidate)) {
      return candidate;
    }
  }
  return direction === 1 ? WHITE : BLACK;
};

const clears = (floor: number, foreground: Rgba, ...backgrounds: Rgba[]) =>
  backgrounds.every((background) => contrastBetween(foreground, background) >= floor);

const onAccentFor = (accent: Rgba) =>
  contrastBetween(BLACK, accent) >= contrastBetween(WHITE, accent) ? BLACK : WHITE;

const hoverFor = (accent: Rgba, onAccent: Rgba, ground: Rgba) => {
  const awayFromOnAccent: Direction = onAccent === BLACK ? 1 : -1;
  for (let step = HOVER_STEPS; step > 0; step--) {
    const candidate = snapToBytes(
      fromOklch(shift(toOklch(accent), awayFromOnAccent * step * LIGHTNESS_STEP))
    );
    if (clears(TEXT_FLOOR, onAccent, candidate) && clears(NON_TEXT_FLOOR, candidate, ground)) {
      return candidate;
    }
  }
  return accent;
};

const derive = (input: Rgba, ground: Rgba, family: ModeFamily): DerivedAccent => {
  const start = toOklch(composite(input, ground));
  const accent = stepUntil(
    start,
    AWAY_FROM_GROUND[family],
    (candidate) =>
      clears(NON_TEXT_FLOOR, candidate, ground) &&
      clears(TEXT_FLOOR, onAccentFor(candidate), candidate)
  );
  const onAccent = onAccentFor(accent);
  const accentHover = hoverFor(accent, onAccent, ground);
  const accentSoft = { ...accent, alpha: SOFT_ALPHA };
  const softOverGround = snapToBytes(composite(accentSoft, ground));
  const accentInk = stepUntil(start, AWAY_FROM_GROUND[family], (candidate) =>
    clears(TEXT_FLOOR, candidate, ground, softOverGround)
  );
  return {
    accent: formatHex(accent),
    accentHover: formatHex(accentHover),
    accentSoft: formatHex(accentSoft),
    onAccent: formatHex(onAccent),
    accentInk: formatHex(accentInk),
  };
};

export const deriveAccent = (
  hex: string,
  family: ModeFamily
): Result<DerivedAccent, InvalidColour> =>
  overGround(hex, ACCENT_GROUNDS[family], (input, ground) => derive(input, ground, family));
