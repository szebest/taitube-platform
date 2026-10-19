import { ErrorCodes } from '@vp/errors';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { ACCENT_GROUNDS, deriveAccent, groundsInsideAccentBand, type ModeFamily } from '../accent';
import { toOklch } from '../color/oklch';
import { compositeOver, parseGround } from '../color/rgb';
import { checkContrast } from '../contrast';

const FAMILIES: readonly ModeFamily[] = ['dark', 'light'];

const HOSTILE = [
  { label: 'pure yellow', hex: '#FFFF00' },
  { label: 'pure blue', hex: '#0000FF' },
  { label: 'near-white', hex: '#FAFAFA' },
  { label: 'near-black', hex: '#050505' },
  { label: 'mid grey', hex: '#777777' },
  { label: 'translucent yellow', hex: '#FFFF0080' },
  { label: 'the dark ground', hex: ACCENT_GROUNDS.dark },
  { label: 'the light ground', hex: ACCENT_GROUNDS.light },
];

const oklch = (hex: string) => toOklch(expectOk(parseGround(hex)));

const derived = (hex: string, family: ModeFamily) => expectOk(deriveAccent(hex, family));

const LEVELS = Array.from({ length: 8 }, (_, level) =>
  Math.round((level * 255) / 7)
    .toString(16)
    .padStart(2, '0')
);

const SRGB_SWEEP = LEVELS.flatMap((r) => LEVELS.flatMap((g) => LEVELS.map((b) => `#${r}${g}${b}`)));

const missedFloors = (hex: string, family: ModeFamily) => {
  const ground = ACCENT_GROUNDS[family];
  const { accent, accentHover, accentSoft, onAccent, accentInk } = derived(hex, family);
  const softOverGround = expectOk(compositeOver(accentSoft, ground));
  return checkContrast([
    { hex, pair: 'accent on the ground', foreground: accent, background: ground, floor: 3 },
    { hex, pair: 'on-accent on accent', foreground: onAccent, background: accent, floor: 4.5 },
    { hex, pair: 'on-accent on hover', foreground: onAccent, background: accentHover, floor: 4.5 },
    { hex, pair: 'hover on the ground', foreground: accentHover, background: ground, floor: 3 },
    { hex, pair: 'ink on the ground', foreground: accentInk, background: ground, floor: 4.5 },
    { hex, pair: 'ink on soft', foreground: accentInk, background: softOverGround, floor: 4.5 },
  ]);
};

describe('deriveAccent', () => {
  it.each(FAMILIES.flatMap((family) => HOSTILE.map((input) => ({ ...input, family }))))(
    'turns $label into an accent that passes in $family mode',
    ({ hex, family }) => {
      const { accent, accentSoft } = derived(hex, family);

      expect(accent).toMatch(/^#[0-9A-F]{6}$/);
      expect(accentSoft).toBe(`${accent}29`);
      expect(missedFloors(hex, family)).toEqual([]);
    }
  );

  it.each(FAMILIES)('meets every floor across a sweep of the sRGB cube in %s mode', (family) => {
    expect(SRGB_SWEEP.flatMap((hex) => missedFloors(hex, family))).toEqual([]);
  });

  it.each([
    { label: 'every swept colour', family: 'dark', flat: [] },
    {
      label: 'every swept colour but black, which 0.05 lightness leaves black',
      family: 'light',
      flat: ['#000000'],
    },
  ] as const)('gives $label a hover of its own in $family mode', ({ family, flat }) => {
    const withoutHover = SRGB_SWEEP.filter((hex) => {
      const { accent, accentHover } = derived(hex, family);
      return accentHover === accent;
    });

    expect(withoutHover).toEqual(flat);
  });

  it.each([
    { label: 'Sand dark brass', hex: '#C9A66B', family: 'dark', lighter: true },
    { label: 'Sand light ochre', hex: '#86683A', family: 'light', lighter: false },
    { label: 'Nocturne light amber', hex: '#B07620', family: 'light', lighter: true },
  ] as const)('moves the hover of $label away from its on-accent', ({ hex, family, lighter }) => {
    const { accent, accentHover } = derived(hex, family);

    expect(oklch(accentHover).l > oklch(accent).l).toBe(lighter);
  });

  it.each([
    { label: 'Sand dark brass', hex: '#C9A66B', family: 'dark', onAccent: '#000000' },
    { label: 'Sand light ochre', hex: '#86683A', family: 'light', onAccent: '#FFFFFF' },
    { label: 'Nocturne dark amber', hex: '#FFB547', family: 'dark', onAccent: '#000000' },
  ] as const)('keeps $label, which already passes', ({ hex, family, onAccent }) => {
    expect(derived(hex, family)).toMatchObject({ accent: hex, onAccent });
  });

  it.each([
    { label: 'darkens a bright amber', hex: '#FFB547', family: 'light' },
    { label: 'darkens a light sky blue', hex: '#7CC4FA', family: 'light' },
    { label: 'lightens a deep indigo', hex: '#2E1A87', family: 'dark' },
    { label: 'lightens a dark red', hex: '#7A0F12', family: 'dark' },
  ] as const)('$label in $family mode, keeping its hue', ({ hex, family }) => {
    const { accent, accentInk } = derived(hex, family);
    const lighter = oklch(accent).l > oklch(hex).l;

    expect(lighter).toBe(family === 'dark');
    expect(Math.abs(oklch(accent).h - oklch(hex).h)).toBeLessThan(2);
    expect(Math.abs(oklch(accentInk).h - oklch(hex).h)).toBeLessThan(2);
  });

  it.each(FAMILIES)('rejects a malformed hex in %s mode rather than painting it', (family) => {
    expect(deriveAccent('yellow', family)).toEqual(
      err({
        code: ErrorCodes.VALIDATION_FAILED,
        message: expect.any(String),
        field: 'foreground',
        value: 'yellow',
      })
    );
  });
});

describe('groundsInsideAccentBand', () => {
  it.each([
    {
      label: 'Sand dark grounds',
      grounds: ['#14120F', '#1C1915', '#26221D'],
      family: 'dark',
      inside: true,
    },
    {
      label: 'Nocturne light grounds',
      grounds: ['#F5F7FA', '#FFFFFF'],
      family: 'light',
      inside: true,
    },
    { label: 'the dark edge itself', grounds: [ACCENT_GROUNDS.dark], family: 'dark', inside: true },
    {
      label: 'the light edge itself',
      grounds: [ACCENT_GROUNDS.light],
      family: 'light',
      inside: true,
    },
    {
      label: 'a dark ground lighter than the edge',
      grounds: ['#14120F', '#2A2A2A'],
      family: 'dark',
      inside: false,
    },
    {
      label: 'a light ground darker than the edge',
      grounds: ['#E0E0E0'],
      family: 'light',
      inside: false,
    },
    {
      label: 'a dark ground in the light family',
      grounds: ['#14120F'],
      family: 'light',
      inside: false,
    },
    { label: 'a translucent ground', grounds: ['#00000080'], family: 'dark', inside: false },
    { label: 'a malformed ground', grounds: ['black'], family: 'dark', inside: false },
  ] as const)('answers $inside for $label', ({ grounds, family, inside }) => {
    expect(groundsInsideAccentBand(grounds, family)).toBe(inside);
  });
});
