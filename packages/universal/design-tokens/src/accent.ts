import { fromOklch, toOklch } from './color/oklch';
import { composite, formatHex, parseHex } from './color/rgb';
import { checkContrast, contrastRatio } from './contrast';

export type ModeFamily = 'dark' | 'light';

// The lightest dark and the darkest light ground a theme may put the accent on:
// an accent clearing its floor here clears it on every ground further out.
export const ACCENT_GROUNDS: Readonly<Record<ModeFamily, string>> = {
  dark: '#262626',
  light: '#EBEBEB',
};

export type DerivedAccent = Readonly<{
  /** At least 3:1 against `ACCENT_GROUNDS[family]`: the floor for fills, outlines and icons. */
  accent: string;
  /** Black or white, whichever reads better, at least 4.5:1 on `accent`. */
  onAccent: string;
}>;

const ACCENT_FLOOR = 3;

const ON_ACCENT_FLOOR = 4.5;

const ON_ACCENT_CANDIDATES = ['#000000', '#FFFFFF'] as const;

const LIGHTNESS_STEP = 0.01;

const STEPS_ACROSS_LIGHTNESS = 1 / LIGHTNESS_STEP;

const DIRECTION: Readonly<Record<ModeFamily, 1 | -1>> = { dark: 1, light: -1 };

const EXTREME: Readonly<Record<ModeFamily, DerivedAccent>> = {
  dark: { accent: '#FFFFFF', onAccent: '#000000' },
  light: { accent: '#000000', onAccent: '#FFFFFF' },
};

const withOnAccent = (accent: string): DerivedAccent => {
  const [black, white] = ON_ACCENT_CANDIDATES;
  const onAccent = contrastRatio(black, accent) >= contrastRatio(white, accent) ? black : white;
  return { accent, onAccent };
};

const passes = ({ accent, onAccent }: DerivedAccent, ground: string) =>
  checkContrast([
    { foreground: accent, background: ground, floor: ACCENT_FLOOR },
    { foreground: onAccent, background: accent, floor: ON_ACCENT_FLOOR },
  ]).length === 0;

export const deriveAccent = (hex: string, family: ModeFamily): DerivedAccent => {
  const ground = ACCENT_GROUNDS[family];
  const start = toOklch(composite(parseHex(hex), parseHex(ground)));
  for (let step = 0; step <= STEPS_ACROSS_LIGHTNESS; step++) {
    const l = start.l + DIRECTION[family] * step * LIGHTNESS_STEP;
    const candidate = withOnAccent(formatHex(fromOklch({ ...start, l })));
    if (passes(candidate, ground)) {
      return candidate;
    }
  }
  return EXTREME[family];
};
