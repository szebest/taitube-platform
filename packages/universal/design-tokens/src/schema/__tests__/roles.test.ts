import { expectOk } from '@vp/testing/result';
import { parseTheme } from '../../parse';
import { checkRoleContrast, type RoleColors } from '../roles';
import { THEME_NAMES, type ThemeName, themeFromTokens } from './tokens-json';

type ThemeMode = 'dark' | 'light' | 'oled';

const THEME_MODES: readonly ThemeMode[] = ['dark', 'light', 'oled'];

const rolesOf = (name: ThemeName, mode: ThemeMode): RoleColors => {
  const { color } = expectOk(parseTheme(themeFromTokens(name)));
  return mode === 'oled' ? { ...color.dark, ...color.oled } : color[mode];
};

const sandDark = (overrides: Partial<RoleColors> = {}): RoleColors => ({
  ...rolesOf('sand', 'dark'),
  ...overrides,
});

const failingPairs = (roles: RoleColors) => checkRoleContrast(roles).map(({ label }) => label);

describe('checkRoleContrast', () => {
  it.each(THEME_NAMES.flatMap((name) => THEME_MODES.map((mode) => ({ name, mode }))))(
    'clears every required pair in $name $mode from tokens.json, translucent grounds composited over bg',
    ({ name, mode }) => {
      expect(failingPairs(rolesOf(name, mode))).toEqual([]);
    }
  );

  it.each([
    {
      label: 'muted text at 2.4:1',
      overrides: { 'fg-muted': '#5A5248' },
      failing: ['fg-muted on bg', 'fg-muted on surface', 'fg-muted on raised'],
    },
    {
      label: 'a control outline at 3.1:1, which only needs 3',
      overrides: { 'border-strong': '#706658' },
      failing: [],
    },
    {
      label: 'a control outline at 2.9:1 on surface',
      overrides: { 'border-strong': '#6B6256' },
      failing: ['border-strong on surface'],
    },
    {
      label: 'a focus ring lost on the ground',
      overrides: { 'focus-ring': '#26221D' },
      failing: ['focus-ring on bg', 'focus-ring on surface'],
    },
  ])('fails exactly the pairs under their floor for $label', ({ overrides, failing }) => {
    expect(failingPairs(sandDark(overrides))).toEqual(failing);
  });

  it('reports the hex values it measured with the ratio', () => {
    expect(checkRoleContrast(sandDark({ 'on-live': '#F59298' }))).toEqual([
      {
        label: 'on-live on live',
        foreground: '#F59298',
        background: '#D91F3A',
        floor: 4.5,
        ratio: expect.closeTo(2.25, 2),
      },
    ]);
  });
});
