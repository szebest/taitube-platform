import { expectOk } from '@vp/testing/result';
import { parseTheme, resolveTheme } from '../../parse';
import { RefSchema } from '../ref';
import { checkRoleContrast, type RoleColors } from '../roles';
import { refFromTokens, THEME_NAMES, type ThemeName, themeFromTokens } from './tokens-json';

type ThemeMode = 'dark' | 'light' | 'oled';

const THEME_MODES: readonly ThemeMode[] = ['dark', 'light', 'oled'];

const rolesOf = (name: ThemeName, mode: ThemeMode): RoleColors => {
  const theme = expectOk(parseTheme(themeFromTokens(name)));
  const { color } = expectOk(resolveTheme(theme, RefSchema.parse(refFromTokens())));
  return mode === 'oled' ? { ...color.dark, ...color.oled } : color[mode];
};

const sandDark = (overrides: Partial<RoleColors> = {}): RoleColors => ({
  ...rolesOf('sand', 'dark'),
  ...overrides,
});

const failingPairs = (
  roles: RoleColors,
  contrast: 'standard' | 'more' = 'standard',
  set: 'core' | 'drawn' = 'core'
) => checkRoleContrast(roles, contrast, set).map(({ label }) => label);

const sandLight = (overrides: Partial<RoleColors> = {}): RoleColors => ({
  ...rolesOf('sand', 'light'),
  ...overrides,
});

describe('checkRoleContrast', () => {
  it.each(THEME_NAMES.flatMap((name) => THEME_MODES.map((mode) => ({ name, mode }))))(
    'clears every required pair in $name $mode from tokens.json, translucent grounds composited over bg',
    ({ name, mode }) => {
      expect(failingPairs(rolesOf(name, mode))).toEqual([]);
    }
  );

  it.each<{ label: string; overrides: Partial<RoleColors>; failing: string[] }>([
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

  it.each([
    { name: 'sand' as const, mode: 'light' as const },
    { name: 'nocturne' as const, mode: 'dark' as const },
  ])(
    'clears every pair a component draws in $name $mode, standard and under more contrast',
    ({ name, mode }) => {
      expect(failingPairs(rolesOf(name, mode), 'standard', 'drawn')).toEqual([]);
      expect(failingPairs(rolesOf(name, mode), 'more', 'drawn')).toEqual([]);
    }
  );

  it.each<{
    label: string;
    roles: RoleColors;
    contrast?: 'standard' | 'more';
    failing: string[];
  }>([
    {
      label: 'a success ink at 4.2:1 on a tint',
      roles: sandLight({ 'success-ink': '#2F7A47' }),
      failing: [
        'success-ink on tint / bg',
        'success-ink on tint-strong / bg',
        'success-ink on tint-strong / surface',
        'success-ink on tint-strong / raised',
        'success-ink on accent-soft / bg',
        'success-ink on accent-soft / surface',
        'success-ink on accent-soft / raised',
      ],
    },
    {
      label: 'a placeholder at 3.5:1 on the page',
      roles: sandLight({ 'fg-subtle': '#8A8072' }),
      failing: ['fg-subtle on bg', 'fg-subtle on surface', 'fg-subtle on raised'],
    },
    {
      label: 'an invalid border at 2.99:1 on a floating layer',
      roles: sandDark({ danger: '#C8323C' }),
      failing: ['danger on raised'],
    },
    {
      label: 'a strong border at 2.7:1 on a floating layer',
      roles: sandDark({ 'border-strong': '#5E554A' }),
      failing: ['border-strong on bg', 'border-strong on surface', 'border-strong on raised'],
    },
    {
      label: 'a strong border under more contrast, where it is also the hairline',
      roles: sandDark({ 'border-strong': '#5E554A' }),
      contrast: 'more',
      failing: [
        'border-strong on bg',
        'border-strong on surface',
        'border-strong on raised',
        'border on bg',
        'border on surface',
        'border on raised',
      ],
    },
  ])(
    'fails exactly the drawn pairs under their floor for $label',
    ({ roles, contrast, failing }) => {
      expect(failingPairs(roles, contrast, 'drawn')).toEqual(failing);
    }
  );

  it('leaves the drawn pairs out of the core set', () => {
    expect(failingPairs(sandLight({ 'fg-subtle': '#8A8072' }), 'standard', 'core')).toEqual([]);
  });

  it('reports the hex values it measured with the ratio', () => {
    expect(checkRoleContrast(sandDark({ 'on-live': '#F59298' }), 'standard', 'core')).toEqual([
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
