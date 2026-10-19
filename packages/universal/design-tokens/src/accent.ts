import type { Result } from '@vp/result';
import { fromOklch, type Oklch, toOklch } from './color/oklch';
import { composite, formatHex, type InvalidColour, overGround } from './color/rgb';
import { type ContrastPair, checkContrast, contrastRatio } from './contrast';

export type ModeFamily = 'dark' | 'light';

// The lightest dark and the darkest light ground a theme may put the accent on:
// an accent clearing its floor here clears it on every ground further out.
export const ACCENT_GROUNDS: Readonly<Record<ModeFamily, string>> = {
  dark: '#262626',
  light: '#EBEBEB',
};

export type DerivedAccent = Readonly<{
  /** The fill and the focus ring: at least 3:1 against `ACCENT_GROUNDS[family]`. */
  accent: string;
  /** Black or white, whichever reads better: at least 4.5:1 on `accent`. */
  onAccent: string;
  /** The accent as text: at least 4.5:1 against `ACCENT_GROUNDS[family]`. */
  accentInk: string;
}>;

const NON_TEXT_FLOOR = 3;

const TEXT_FLOOR = 4.5;

const BLACK = '#000000';

const WHITE = '#FFFFFF';

const LIGHTNESS_STEP = 0.01;

const STEPS_ACROSS_LIGHTNESS = 1 / LIGHTNESS_STEP;

const DIRECTION: Readonly<Record<ModeFamily, 1 | -1>> = { dark: 1, light: -1 };

const FURTHEST: Readonly<Record<ModeFamily, string>> = { dark: WHITE, light: BLACK };

const onAccentFor = (accent: string) =>
  contrastRatio(BLACK, accent) >= contrastRatio(WHITE, accent) ? BLACK : WHITE;

const meets = (pairs: readonly ContrastPair[]) => checkContrast(pairs).length === 0;

const stepUntil = (start: Oklch, family: ModeFamily, accepts: (hex: string) => boolean) => {
  for (let step = 0; step <= STEPS_ACROSS_LIGHTNESS; step++) {
    const hex = formatHex(
      fromOklch({ ...start, l: start.l + DIRECTION[family] * step * LIGHTNESS_STEP })
    );
    if (accepts(hex)) {
      return hex;
    }
  }
  return FURTHEST[family];
};

const derive = (start: Oklch, family: ModeFamily): DerivedAccent => {
  const ground = ACCENT_GROUNDS[family];
  const accent = stepUntil(start, family, (candidate) =>
    meets([
      { foreground: candidate, background: ground, floor: NON_TEXT_FLOOR },
      { foreground: onAccentFor(candidate), background: candidate, floor: TEXT_FLOOR },
    ])
  );
  const accentInk = stepUntil(start, family, (candidate) =>
    meets([{ foreground: candidate, background: ground, floor: TEXT_FLOOR }])
  );
  return { accent, onAccent: onAccentFor(accent), accentInk };
};

export const deriveAccent = (
  hex: string,
  family: ModeFamily
): Result<DerivedAccent, InvalidColour> =>
  overGround(hex, ACCENT_GROUNDS[family], (input, ground) =>
    derive(toOklch(composite(input, ground)), family)
  );
