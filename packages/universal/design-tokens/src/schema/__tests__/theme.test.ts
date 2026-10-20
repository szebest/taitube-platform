import { ThemeSchema } from '../theme';
import { THEME_NAMES, themeFromTokens, tokenSetValues } from './tokens-json';

type Theme = ReturnType<typeof themeFromTokens>;

const sandWith = (change: (sand: Theme) => Record<string, unknown>) => {
  const sand = themeFromTokens('sand');
  return { ...sand, ...change(sand) };
};

const withoutKey = (record: Record<string, unknown>, key: string) =>
  Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));

describe('ThemeSchema', () => {
  it.each(THEME_NAMES)('parses %s from tokens.json', (name) => {
    expect(ThemeSchema.safeParse(themeFromTokens(name)).error).toBeUndefined();
  });

  it('lets oled override some roles, inheriting the rest from dark', () => {
    const theme = sandWith(({ color }) => ({ color: { ...color, oled: { bg: '#000000' } } }));

    expect(ThemeSchema.safeParse(theme).success).toBe(true);
  });

  it.each([
    {
      label: 'dark missing a role',
      theme: sandWith(({ color }) => ({ color: { ...color, dark: withoutKey(color.dark, 'fg') } })),
    },
    {
      label: 'light naming a role that does not exist',
      theme: sandWith(({ color }) => ({
        color: { ...color, light: { ...color.light, glow: '#FFFFFF' } },
      })),
    },
    {
      label: 'oled naming a role that does not exist',
      theme: sandWith(({ color }) => ({ color: { ...color, oled: { glow: '#FFFFFF' } } })),
    },
    {
      label: 'a role that is not a hex colour',
      theme: sandWith(({ color }) => ({
        color: { ...color, dark: { ...color.dark, fg: 'white' } },
      })),
    },
    {
      label: 'a role naming a ramp but no step',
      theme: sandWith(({ color }) => ({
        color: { ...color, dark: { ...color.dark, fg: '{ref.sand}' } },
      })),
    },
    { label: 'an id the account cannot store', theme: sandWith(() => ({ id: 'Sand' })) },
    { label: 'an empty name', theme: sandWith(() => ({ name: '' })) },
    {
      label: 'a categorical palette one series short',
      theme: sandWith(({ dataviz }) => ({
        dataviz: {
          ...dataviz,
          'categorical-dark': ['#C9A66B', '#8FB89A', '#7FA3D1', '#D98A6C', '#B59AD6'],
        },
      })),
    },
    {
      label: 'defaults missing a group',
      theme: sandWith(({ defaults }) => ({ defaults: withoutKey(defaults, 'shadow') })),
    },
    {
      label: 'a radius set as the shadow default',
      theme: sandWith(({ defaults }) => ({ defaults: { ...defaults, shadow: defaults.radius } })),
    },
    {
      label: 'a default set missing a value',
      theme: sandWith(({ defaults }) => ({
        defaults: {
          ...defaults,
          radius: {
            group: 'radius',
            id: 'round',
            values: withoutKey(tokenSetValues('radius').round ?? {}, 'card'),
          },
        },
      })),
    },
  ])('rejects a theme with $label', ({ theme }) => {
    expect(ThemeSchema.safeParse(theme).success).toBe(false);
  });
});
