import { checkRoleContrast, type RoleColors } from '../roles';

const sandDark = (overrides: Partial<RoleColors> = {}): RoleColors => ({
  bg: '#14120F',
  surface: '#1C1915',
  raised: '#26221D',
  border: '#332E27',
  'border-strong': '#8A8072',
  fg: '#EFE9E0',
  'fg-muted': '#A89F92',
  'fg-subtle': '#8A8072',
  tint: '#FFFAF012',
  'tint-strong': '#FFFAF01F',
  accent: '#C9A66B',
  'accent-hover': '#D2B076',
  'on-accent': '#14120F',
  'accent-ink': '#D2B076',
  'accent-soft': '#C9A66B29',
  'focus-ring': '#D2B076',
  live: '#D91F3A',
  'on-live': '#FFFFFF',
  danger: '#C8323C',
  'danger-ink': '#F59298',
  'success-ink': '#8CC79D',
  'warning-ink': '#F7A27A',
  'info-ink': '#93B4DE',
  scrim: '#0C0B09B8',
  media: '#000000',
  ...overrides,
});

const failingPairs = (roles: RoleColors) => checkRoleContrast(roles).map(({ label }) => label);

describe('checkRoleContrast', () => {
  it.each([
    {
      label: 'Sand dark, its translucent accent-soft composited over bg',
      overrides: {},
      failing: [],
    },
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
