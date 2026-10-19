import { expectOk } from '@vp/testing/result';
import { defineAppearance, defineTheme, defineTokenSet } from '../define';
import { parseTheme } from '../parse';
import { themeFromTokens } from '../schema/__tests__/tokens-json';

const { color, dataviz, defaults: parsed } = expectOk(parseTheme(themeFromTokens('sand')));

const shadowSoft = defineTokenSet('shadow', 'soft', parsed.shadow.values);

const shadowDeep = defineTokenSet('shadow', 'deep', parsed.shadow.values);

const defaults = {
  typography: defineTokenSet('typography', 'figtree', parsed.typography.values),
  fontSize: defineTokenSet('fontSize', 'default', parsed.fontSize.values),
  spacing: defineTokenSet('spacing', 'default', parsed.spacing.values),
  sizing: defineTokenSet('sizing', 'medium', parsed.sizing.values),
  radius: defineTokenSet('radius', 'round', parsed.radius.values),
  border: defineTokenSet('border', 'hairline', parsed.border.values),
  shadow: shadowSoft,
  ambient: defineTokenSet('ambient', 'cinematic', parsed.ambient.values),
  motion: defineTokenSet('motion', 'standard', parsed.motion.values),
};

const sand = defineTheme({ id: 'sand', name: 'Sand', color, dataviz, defaults });

const deepSand = defineTheme({
  id: 'deep-sand',
  name: 'Deep sand',
  color,
  dataviz,
  defaults: { ...defaults, shadow: shadowDeep },
});

const offer = {
  typography: [defaults.typography],
  fontSize: [defaults.fontSize],
  spacing: [defaults.spacing],
  sizing: [defaults.sizing],
  radius: [defaults.radius],
  border: [defaults.border],
  shadow: [shadowSoft],
  ambient: [defaults.ambient],
  motion: [defaults.motion],
} as const;

describe('define', () => {
  it('keeps a token set group and id as literal types', () => {
    expect(shadowDeep.id satisfies 'deep').toBe('deep');
    expect(shadowDeep).toEqual({ group: 'shadow', id: 'deep', values: parsed.shadow.values });
  });

  it('refuses a token set missing a key', () => {
    const { card: _card, ...withoutCard } = parsed.radius.values;

    // @ts-expect-error a radius set names every radius role
    defineTokenSet('radius', 'round', withoutCard);
  });

  it('refuses a theme without a default for every group', () => {
    const { shadow: _shadow, ...withoutShadow } = defaults;

    // @ts-expect-error a theme names a default set for every group
    defineTheme({ id: 'sand', name: 'Sand', color, dataviz, defaults: withoutShadow });
  });

  it('refuses a theme missing a role in a mode', () => {
    const { fg: _fg, ...darkWithoutFg } = color.dark;
    const withoutFg = { ...color, dark: darkWithoutFg };

    // @ts-expect-error a theme names every role in every mode
    defineTheme({ id: 'sand', name: 'Sand', color: withoutFg, dataviz, defaults });
  });

  it('builds an appearance whose themes default only to offered sets', () => {
    const appearance = defineAppearance({ themes: [sand], defaultTheme: sand, offer });

    expect(appearance.defaultTheme.id satisfies 'sand').toBe('sand');
  });

  it('refuses a theme defaulting to a set that is not offered', () => {
    // @ts-expect-error deep sand defaults to shadowDeep, which the offer leaves out
    defineAppearance({ themes: [sand, deepSand], defaultTheme: sand, offer });
  });

  it('refuses a default theme that is not one of the themes', () => {
    const offerWithDeep = { ...offer, shadow: [shadowSoft, shadowDeep] } as const;

    // @ts-expect-error deep sand is not among the themes
    defineAppearance({ themes: [sand], defaultTheme: deepSand, offer: offerWithDeep });
  });
});
