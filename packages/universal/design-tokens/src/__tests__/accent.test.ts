import { ErrorCodes } from '@vp/errors';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { ACCENT_GROUNDS, deriveAccent, groundsInsideAccentBand, type ModeFamily } from '../accent';
import { toOklch } from '../color/oklch';
import { parseHex } from '../color/rgb';
import { contrastRatio } from '../contrast';

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

const oklch = (hex: string) => toOklch(expectOk(parseHex(hex)));

const derived = (hex: string, family: ModeFamily) => expectOk(deriveAccent(hex, family));

describe('deriveAccent', () => {
  it.each(FAMILIES.flatMap((family) => HOSTILE.map((input) => ({ ...input, family }))))(
    'turns $label into an accent that passes in $family mode',
    ({ hex, family }) => {
      const { accent, onAccent, accentInk } = derived(hex, family);

      expect(accent).toMatch(/^#[0-9A-F]{6}$/);
      expect(contrastRatio(accent, ACCENT_GROUNDS[family])).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(onAccent, accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(accentInk, ACCENT_GROUNDS[family])).toBeGreaterThanOrEqual(4.5);
    }
  );

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
